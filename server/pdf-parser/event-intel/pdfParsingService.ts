import { and, eq } from "drizzle-orm";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { db } from "../../db";
import {
  eventArtifacts,
  eventConventionSchedules,
  eventRunSheets,
  parsingJobs,
} from "../../schema";
import type {
  DetectedPdfType,
  NormalizedConventionScheduleRow,
  NormalizedRunSheetRow,
  ParsingJobStatus,
} from "./types";
import {
  parseNyCdaConventionSchedule,
  parseNyCdaRunSheet,
} from "./parsers/nycda";
import { CompParser } from "../parsers/comp_parser";
import { ConventionParser } from "../parsers/convention_parser";
import type { ParsedConventionClass, ParsedRunSlot } from "../types";

type LoadedEventArtifact = {
  eventId: string;
  artifactId: string;
  brand: string;
  bytes: Buffer;
  fileName?: string;
};

export interface EventArtifactLoader {
  loadArtifact(eventId: string, artifactId: string): Promise<LoadedEventArtifact>;
}

type BrandParseOutput = {
  runSheetRows: NormalizedRunSheetRow[];
  conventionScheduleRows: NormalizedConventionScheduleRow[];
};

class DatabaseEventArtifactLoader implements EventArtifactLoader {
  private resolveStoragePath(storageKey: string): string {
    const trimmedStorageKey = String(storageKey || "").trim();
    if (!trimmedStorageKey) {
      throw new Error("Artifact storage key is empty.");
    }

    if (/^https?:\/\//i.test(trimmedStorageKey)) {
      throw new Error(
        `Remote artifact URLs are not supported yet (storage_key=${trimmedStorageKey}).`,
      );
    }

    if (path.isAbsolute(trimmedStorageKey)) {
      return path.normalize(trimmedStorageKey);
    }

    const configuredBaseDir = process.env.EVENT_ARTIFACTS_BASE_DIR?.trim();
    if (configuredBaseDir) {
      return path.resolve(configuredBaseDir, trimmedStorageKey);
    }

    return path.resolve(process.cwd(), trimmedStorageKey);
  }

  async loadArtifact(eventId: string, artifactId: string): Promise<LoadedEventArtifact> {
    const [artifact] = await db
      .select({
        id: eventArtifacts.id,
        eventId: eventArtifacts.eventId,
        brand: eventArtifacts.brand,
        artifactType: eventArtifacts.artifactType,
        sourceUrl: eventArtifacts.sourceUrl,
        storageKey: eventArtifacts.storageKey,
        status: eventArtifacts.status,
      })
      .from(eventArtifacts)
      .where(and(eq(eventArtifacts.id, artifactId), eq(eventArtifacts.eventId, eventId)))
      .limit(1);

    if (!artifact) {
      throw new Error(`Artifact not found for eventId=${eventId}, artifactId=${artifactId}.`);
    }

    const resolvedStoragePath = this.resolveStoragePath(artifact.storageKey);

    let bytes: Buffer;
    try {
      bytes = await fs.readFile(resolvedStoragePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown file read error";
      throw new Error(
        `Failed to read artifact file for eventId=${eventId}, artifactId=${artifactId}, path=${resolvedStoragePath}. ${message}`,
      );
    }

    return {
      eventId: artifact.eventId,
      artifactId: artifact.id,
      brand: artifact.brand,
      bytes,
      fileName: path.basename(resolvedStoragePath),
    };
  }
}

export class PdfParsingService {
  constructor(private readonly artifactLoader: EventArtifactLoader = new DatabaseEventArtifactLoader()) {}

  private readonly genericRunSheetParser = new CompParser();
  private readonly genericConventionParser = new ConventionParser();

  /**
   * Lightweight detector used before full parse.
   * NOTE: This is intentionally conservative for the skeleton pass.
   */
  detectPdfType(buffer: Buffer): DetectedPdfType {
    const sample = buffer.toString("latin1", 0, Math.min(buffer.length, 128_000));
    const hasTextHints = /\/Font|\/ToUnicode|\bBT\b|\bTf\b/.test(sample);
    return hasTextHints ? "TEXT" : "SCANNED_UNSUPPORTED";
  }

  async parseEventArtifact(eventId: string, artifactId: string): Promise<void> {
    let jobId: string | null = null;
    let brand = "UNKNOWN";

    try {
      const artifact = await this.artifactLoader.loadArtifact(eventId, artifactId);
      brand = this.normalizeBrand(artifact.brand);

      const [pendingJob] = await db
        .insert(parsingJobs)
        .values({
          eventId,
          brand,
          artifactId,
          status: "PENDING",
          rowsRunSheet: 0,
          rowsConvention: 0,
        })
        .returning({ id: parsingJobs.id });
      if (!pendingJob?.id) {
        throw new Error("Failed to create parsing job row.");
      }
      jobId = pendingJob.id;

      const detectorResult = this.detectPdfType(artifact.bytes);
      const extractedPdfText = await this.extractPdfText(artifact.bytes);
      const hasExtractableText = extractedPdfText.trim().length > 0;

      if (detectorResult === "SCANNED_UNSUPPORTED" || !hasExtractableText) {
        await this.updateParsingJob(jobId, {
          status: "SCANNED_UNSUPPORTED",
          errorMessage: "PDF appears scanned or has no extractable text.",
          rowsRunSheet: 0,
          rowsConvention: 0,
        });
        return;
      }

      const parsed = this.parseByBrand(brand, extractedPdfText);

      if (parsed.runSheetRows.length > 0) {
        await db.insert(eventRunSheets).values(
          parsed.runSheetRows.map((row) => ({
            eventId,
            brand,
            sessionName: row.sessionName ?? null,
            stageName: row.stageName ?? null,
            routineNumber: row.routineNumber ?? null,
            routineName: row.routineName ?? null,
            studioName: row.studioName ?? null,
            division: row.division ?? null,
            age: row.age ?? null,
            level: row.level ?? null,
            category: row.category ?? null,
            scheduledTime: row.scheduledTime ?? null,
            rawLine: row.rawLine ?? null,
          })),
        );
      }

      if (parsed.conventionScheduleRows.length > 0) {
        await db.insert(eventConventionSchedules).values(
          parsed.conventionScheduleRows.map((row) => ({
            eventId,
            brand,
            roomName: row.roomName ?? null,
            blockLabel: row.blockLabel ?? null,
            startTime: row.startTime ?? null,
            endTime: row.endTime ?? null,
            classType: row.classType ?? null,
            facultyName: row.facultyName ?? null,
            level: row.level ?? null,
          })),
        );
      }

      await this.updateParsingJob(jobId, {
        status: "SUCCESS",
        rowsRunSheet: parsed.runSheetRows.length,
        rowsConvention: parsed.conventionScheduleRows.length,
        errorMessage: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown parser failure";

      if (jobId) {
        await this.updateParsingJob(jobId, {
          status: "FAILED",
          errorMessage,
          rowsRunSheet: 0,
          rowsConvention: 0,
        });
      } else {
        await db.insert(parsingJobs).values({
          eventId,
          brand,
          artifactId,
          status: "FAILED",
          rowsRunSheet: 0,
          rowsConvention: 0,
          errorMessage,
        });
      }

      throw error;
    }
  }

  private parseByBrand(brand: string, pdfText: string): BrandParseOutput {
    switch (brand) {
      case "NYCDA": {
        const brandSpecific = {
          runSheetRows: parseNyCdaRunSheet(pdfText),
          conventionScheduleRows: parseNyCdaConventionSchedule(pdfText),
        };
        if (
          brandSpecific.runSheetRows.length > 0 ||
          brandSpecific.conventionScheduleRows.length > 0
        ) {
          return brandSpecific;
        }
        return this.parseWithGenericParsers(pdfText);
      }
      default:
        // For non-NYCDA brands (e.g. WCDE), use company-agnostic parsers.
        return this.parseWithGenericParsers(pdfText);
    }
  }

  private parseWithGenericParsers(pdfText: string): BrandParseOutput {
    const runSheetRows = this.genericRunSheetParser
      .parseRunSheet(pdfText)
      .map((row) => this.mapRunSheetRow(row));

    const conventionScheduleRows = this.genericConventionParser
      .parseConvention(pdfText)
      .map((row) => this.mapConventionRow(row));

    return {
      runSheetRows,
      conventionScheduleRows,
    };
  }

  private mapRunSheetRow(row: ParsedRunSlot): NormalizedRunSheetRow {
    return {
      sessionName: row.day || null,
      stageName: row.stage || null,
      routineNumber: row.entryNumber || null,
      routineName: row.routineName || null,
      studioName: row.studioName || null,
      division: row.division || null,
      level: null,
      category: row.style || null,
      scheduledTime: row.performanceTime || null,
      rawLine: row.rawText || null,
    };
  }

  private mapConventionRow(row: ParsedConventionClass): NormalizedConventionScheduleRow {
    return {
      roomName: row.room || null,
      blockLabel: row.day || null,
      startTime: row.startTime || null,
      endTime: row.endTime || null,
      classType: row.className || null,
      facultyName: row.instructor || null,
      level: row.level || row.division || null,
    };
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    const pdf = new PDFParse(new Uint8Array(buffer));
    const textResult = await pdf.getText();
    return textResult.text ?? "";
  }

  private normalizeBrand(rawBrand: string): string {
    const normalized = String(rawBrand || "").trim().toUpperCase();
    return normalized || "UNKNOWN";
  }

  private async updateParsingJob(
    jobId: string,
    payload: {
      status: ParsingJobStatus;
      rowsRunSheet: number;
      rowsConvention: number;
      errorMessage: string | null;
    },
  ): Promise<void> {
    await db
      .update(parsingJobs)
      .set({
        status: payload.status,
        rowsRunSheet: payload.rowsRunSheet,
        rowsConvention: payload.rowsConvention,
        errorMessage: payload.errorMessage,
      })
      .where(eq(parsingJobs.id, jobId));
  }
}

export const pdfParsingService = new PdfParsingService();
