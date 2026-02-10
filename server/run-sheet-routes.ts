/**
 * Competition Run Sheet API Routes
 * Simple PDF import and editable table management
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { PDFExtractor } from "./pdf-extractor";
import { storage } from "./storage";
import type { InsertCompetitionRunSheet } from "./schema";

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

const pdfExtractor = new PDFExtractor();

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
  app.post("/api/competitions/:competitionId/run-sheet/import", upload.single('pdf'), async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const file = req.file;
      const importModeRaw = (req.body?.mode || req.query?.mode || 'auto') as string;
      const importMode = ['auto', 'text', 'ocr'].includes(importModeRaw) ? (importModeRaw as 'auto' | 'text' | 'ocr') : 'auto';

      if (!file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      // Verify competition exists
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      // Extract text from PDF
      const extractionResult = await pdfExtractor.extractRunSheet(file.buffer, { mode: importMode });

      if (!extractionResult.success && extractionResult.errors.length > 0) {
        return res.status(400).json({
          error: "Failed to extract PDF",
          details: extractionResult.errors,
          warnings: extractionResult.warnings
        });
      }

      // Return extracted entries for user verification (don't save yet)
      return res.status(200).json({
        success: true,
        entries: extractionResult.entries,
        methodUsed: extractionResult.methodUsed,
        confidence: extractionResult.confidence,
        ocrDiagnostics: extractionResult.ocrDiagnostics,
        modeRequested: importMode,
        warnings: extractionResult.warnings,
        message: `Extracted ${extractionResult.entries.length} entries. Please review and save.`
      });

    } catch (error: any) {
      console.error("PDF import error:", error);
      return res.status(500).json({ error: error.message || "Failed to import PDF" });
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
