import { eq } from "drizzle-orm";
import { PDFParse } from "pdf-parse";
import { db } from "../../db";
import {
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

class NotImplementedEventArtifactLoader implements EventArtifactLoader {
  async loadArtifact(eventId: string, artifactId: string): Promise<LoadedEventArtifact> {
    throw new Error(
      `Event artifact loader is not wired yet for eventId=${eventId}, artifactId=${artifactId}.`,
    );
  }
}

export class PdfParsingService {
  constructor(private readonly artifactLoader: EventArtifactLoader = new NotImplementedEventArtifactLoader()) {}

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
      case "NYCDA":
        return {
          runSheetRows: parseNyCdaRunSheet(pdfText),
          conventionScheduleRows: parseNyCdaConventionSchedule(pdfText),
        };
      default:
        // TODO: add additional brands and fallback parser behavior.
        return { runSheetRows: [], conventionScheduleRows: [] };
    }
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
