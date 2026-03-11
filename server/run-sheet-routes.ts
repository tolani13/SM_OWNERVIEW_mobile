/**
 * Competition Run Sheet API Routes
 * Simple PDF import and editable table management
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { storeArtifact } from "./artifact-storage";
import type { InsertCompetitionRunSheet } from "./schema";
import { storage } from "./storage";
import {
  RUN_SHEET_PARSER_CONFIG,
  cleanString,
  getRunSheetParserCandidates,
  mapParserVendorToParserType,
  resolveRunSheetParserOverride,
} from "./run-sheet-import";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

const runSheetEntrySchema = z.object({
  entryNumber: z.string().trim().optional().nullable(),
  routineName: z.string().trim().min(1),
  division: z.string().trim().min(1),
  style: z.string().trim().min(1),
  groupSize: z.string().trim().min(1),
  studioName: z.string().trim().min(1),
  performanceTime: z.string().trim().min(1),
  day: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  placement: z.string().trim().optional().nullable(),
  award: z.string().trim().optional().nullable()
});

const runSheetBulkSchema = z.object({
  entries: z.array(runSheetEntrySchema).min(1)
});

export function registerRunSheetRoutes(app: Express): void {
  
  // ========== IMPORT PDF ==========
  app.post("/api/competitions/:competitionId/run-sheet/import", upload.single("pdf"), async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const parserInput = req.body?.parser ?? req.query?.parser;
      const parserInputNormalized = cleanString(parserInput);
      const parserOverride = resolveRunSheetParserOverride(parserInput);

      if (parserInputNormalized && !parserOverride) {
        return res.status(400).json({
          error: "Invalid parser override.",
          parserRequested: parserInputNormalized,
          allowedParsers: Object.keys(RUN_SHEET_PARSER_CONFIG),
        });
      }

      const parserCandidates = getRunSheetParserCandidates(
        competition.name,
        file.originalname,
        parserOverride,
      );
      const providerKey = parserOverride ?? parserCandidates[0];
      const parserType = parserOverride ? mapParserVendorToParserType(parserOverride) : "AUTO";
      const storedArtifact = await storeArtifact({
        buffer: file.buffer,
        fileName: file.originalname,
        scope: `run-sheet-imports/${competitionId}`,
        contentType: file.mimetype || "application/pdf",
      });

      const createdJob = await storage.createRunSheetImport({
        sourceType: "COMPETITION_RUN_SHEET",
        parserType,
        status: "processing",
        artifactType: "RUN_SHEET",
        originalFileUrl: storedArtifact.originalFileUrl,
        artifactStorageKey: storedArtifact.storageKey,
        errorMessage: null,
        createdByUserId: req.auth?.userId ?? null,
        studioId: req.auth?.studioId ?? null,
        providerKey,
        eventId: null,
        competitionId,
        lockAt: competition.lockAt ?? null,
        eventTimezone: competition.eventTimezone || "UTC",
        publishedAt: null,
      });

      return res.status(202).json({
        success: true,
        job_id: createdJob.id,
        jobId: createdJob.id,
        status: createdJob.status,
        provider_key: createdJob.providerKey,
        parser_type: createdJob.parserType,
        parser_candidates: parserCandidates,
        message: "Run-sheet import queued for background processing.",
      });
    } catch (error: any) {
      console.error("Run-sheet enqueue error:", error);
      return res.status(500).json({ error: error.message || "Failed to queue run-sheet import" });
    }
  });

  // ========== LIST IMPORT JOBS ==========
  app.get("/api/competitions/:competitionId/run-sheet/imports", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const jobs = await storage.listCompetitionRunSheetImports(competitionId);
      return res.json({ jobs });
    } catch (error: any) {
      console.error("List run-sheet imports error:", error);
      return res.status(500).json({ error: error.message || "Failed to list run-sheet imports" });
    }
  });

  // ========== GET IMPORT JOB ==========
  app.get("/api/competitions/:competitionId/run-sheet/imports/:jobId", async (req: Request, res: Response) => {
    try {
      const { competitionId, jobId } = req.params;
      const job = await storage.getCompetitionRunSheetImport(competitionId, jobId);
      if (!job) {
        return res.status(404).json({ error: "Run-sheet import job not found" });
      }

      const entries = await storage.getCompetitionRunSheetsByImportJob(jobId);
      return res.json({
        job_id: job.id,
        job,
        entries,
        entryCount: entries.length,
      });
    } catch (error: any) {
      console.error("Get run-sheet import error:", error);
      return res.status(500).json({ error: error.message || "Failed to fetch run-sheet import" });
    }
  });

  // ========== PUBLISH IMPORT JOB ==========
  app.post("/api/competitions/:competitionId/run-sheet/imports/:jobId/publish", async (req: Request, res: Response) => {
    try {
      const { competitionId, jobId } = req.params;
      const existingJob = await storage.getCompetitionRunSheetImport(competitionId, jobId);
      if (!existingJob) {
        return res.status(404).json({ error: "Run-sheet import job not found" });
      }

      if (existingJob.status !== "needs_review" && existingJob.status !== "published") {
        return res.status(409).json({
          error: `Run-sheet import job is not publishable from status ${existingJob.status}.`,
          status: existingJob.status,
        });
      }

      const publishedJob = await storage.publishCompetitionRunSheetImport(competitionId, jobId);
      const entries = await storage.getCompetitionRunSheetsByImportJob(jobId);
      return res.json({
        success: true,
        job_id: jobId,
        status: publishedJob?.status || existingJob.status,
        publishedAt: publishedJob?.publishedAt || existingJob.publishedAt || null,
        entryCount: entries.length,
      });
    } catch (error: any) {
      console.error("Publish run-sheet import error:", error);
      return res.status(500).json({ error: error.message || "Failed to publish run-sheet import" });
    }
  });

  // ========== GET RUN SHEETS ==========
  app.get("/api/competitions/:competitionId/run-sheet", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const sheets = await storage.getCompetitionRunSheets(competitionId);
      res.json(sheets);
    } catch (error: any) {
      console.error("Get run sheets error:", error);
      res.status(500).json({ error: "Failed to fetch run sheets" });
    }
  });

  // ========== SAVE RUN SHEETS (BULK) ==========
  app.post("/api/competitions/:competitionId/run-sheet", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const parsed = runSheetBulkSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid entries", details: parsed.error.flatten() });
      }

      const { entries } = parsed.data;

      // Verify competition exists
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      // Map entries to database format
      const dbEntries: InsertCompetitionRunSheet[] = entries.map(entry => ({
        competitionId,
        entryNumber: entry.entryNumber || null,
        routineName: entry.routineName,
        division: entry.division,
        style: entry.style,
        groupSize: entry.groupSize,
        studioName: entry.studioName,
        performanceTime: entry.performanceTime,
        day: entry.day || null,
        notes: entry.notes || null,
        placement: entry.placement || null,
        award: entry.award || null
      }));

      // Save to database
      const saved = await storage.createCompetitionRunSheetsBulk(dbEntries);

      return res.status(201).json({
        success: true,
        savedCount: saved.length,
        entries: saved
      });

    } catch (error: any) {
      console.error("Save run sheets error:", error);
      return res.status(500).json({ error: error.message || "Failed to save run sheets" });
    }
  });

  // ========== UPDATE SINGLE RUN SHEET ==========
  app.patch("/api/run-sheet/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const sheet = await storage.updateCompetitionRunSheet(id, updates);
      
      if (!sheet) {
        return res.status(404).json({ error: "Run sheet entry not found" });
      }
      
      res.json(sheet);
    } catch (error: any) {
      console.error("Update run sheet error:", error);
      res.status(400).json({ error: "Failed to update run sheet entry" });
    }
  });

  // ========== DELETE SINGLE RUN SHEET ==========
  app.delete("/api/run-sheet/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteCompetitionRunSheet(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete run sheet error:", error);
      res.status(500).json({ error: "Failed to delete run sheet entry" });
    }
  });

  // ========== DELETE ALL RUN SHEETS FOR COMPETITION ==========
  app.delete("/api/competitions/:competitionId/run-sheet", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      await storage.deleteCompetitionRunSheetsByCompetition(competitionId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete run sheets error:", error);
      res.status(500).json({ error: "Failed to delete run sheets" });
    }
  });

  // ========== ADD SINGLE RUN SHEET (MANUAL ENTRY) ==========
  app.post("/api/competitions/:competitionId/run-sheet/entry", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const parsed = runSheetEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
      }

      const entry = parsed.data;

      // Verify competition exists
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const dbEntry: InsertCompetitionRunSheet = {
        competitionId,
        entryNumber: entry.entryNumber || null,
        routineName: entry.routineName,
        division: entry.division,
        style: entry.style,
        groupSize: entry.groupSize,
        studioName: entry.studioName,
        performanceTime: entry.performanceTime,
        day: entry.day || null,
        notes: entry.notes || null,
        placement: entry.placement || null,
        award: entry.award || null
      };

      const saved = await storage.createCompetitionRunSheet(dbEntry);

      return res.status(201).json(saved);

    } catch (error: any) {
      console.error("Add run sheet entry error:", error);
      return res.status(500).json({ error: error.message || "Failed to add run sheet entry" });
    }
  });
}


