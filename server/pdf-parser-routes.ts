/**
 * PDF Parser API Routes
 * Handles PDF upload, parsing, and schedule management
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { PDFParser } from "./pdf-parser/index";
import { storage } from "./storage";
import type { ParsedRunSlot, ParsedConventionClass } from "./pdf-parser/types";
import type { InsertRunSlot, InsertConventionClass } from "./schema";

// Configure multer for memory storage (PDFs held in memory during processing)
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

const pdfParser = new PDFParser();

export function registerPDFParserRoutes(app: Express): void {
  
  // ========== UPLOAD AND PARSE PDF ==========
  app.post("/api/competitions/:competitionId/parse-pdf", upload.single('pdf'), async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const { type } = req.body; // 'runsheet' or 'convention'
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      // Verify competition exists
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      // Parse PDF
      const parseResult = await pdfParser.parsePDF(
        file.buffer,
        file.originalname,
        type as 'runsheet' | 'convention' | undefined
      );

      if (!parseResult.success) {
        return res.status(400).json({
          error: "Failed to parse PDF",
          details: parseResult.errors,
          warnings: parseResult.warnings,
          metadata: parseResult.metadata
        });
      }

      // Save parsed data to database
      let savedCount = 0;

      if (parseResult.type === 'runsheet') {
        const runSlots = parseResult.data as ParsedRunSlot[];
        
        // Convert parsed data to DB format
        const dbData: InsertRunSlot[] = runSlots.map(slot => ({
          competitionId,
          entryNumber: slot.entryNumber,
          routineName: slot.routineName,
          division: slot.division,
          style: slot.style,
          groupSize: slot.groupSize,
          studioName: slot.studioName,
          day: slot.day,
          performanceTime: slot.performanceTime,
          stage: slot.stage,
          orderNumber: slot.orderNumber,
          rawText: slot.rawText,
          parsedBy: 'auto'
        }));

        const saved = await storage.createRunSlotsBulk(dbData);
        savedCount = saved.length;

      } else {
        const classes = parseResult.data as ParsedConventionClass[];
        
        // Convert parsed data to DB format
        const dbData: InsertConventionClass[] = classes.map(cls => ({
          competitionId,
          className: cls.className,
          instructor: cls.instructor,
          room: cls.room,
          day: cls.day,
          startTime: cls.startTime,
          endTime: cls.endTime,
          duration: cls.duration,
          style: cls.style,
          division: cls.division,
          ageRange: cls.ageRange,
          level: cls.level,
          isAuditionPhrase: cls.isAuditionPhrase,
          rawText: cls.rawText
        }));

        const saved = await storage.createConventionClassesBulk(dbData);
        savedCount = saved.length;
      }

      return res.status(201).json({
        success: true,
        type: parseResult.type,
        company: parseResult.company,
        savedCount,
        totalParsed: parseResult.data.length,
        warnings: parseResult.warnings,
        metadata: parseResult.metadata
      });

    } catch (error: any) {
      console.error("PDF parse error:", error);
      return res.status(500).json({ error: error.message || "Failed to parse PDF" });
    }
  });

  // ========== GET RUN SLOTS ==========
  app.get("/api/competitions/:competitionId/run-slots", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const slots = await storage.getRunSlots(competitionId);
      res.json(slots);
    } catch (error: any) {
      console.error("Get run slots error:", error);
      res.status(500).json({ error: "Failed to fetch run slots" });
    }
  });

  // ========== UPDATE RUN SLOT ==========
  app.patch("/api/run-slots/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const slot = await storage.updateRunSlot(id, req.body);
      
      if (!slot) {
        return res.status(404).json({ error: "Run slot not found" });
      }
      
      res.json(slot);
    } catch (error: any) {
      console.error("Update run slot error:", error);
      res.status(400).json({ error: "Failed to update run slot" });
    }
  });

  // ========== DELETE RUN SLOT ==========
  app.delete("/api/run-slots/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteRunSlot(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete run slot error:", error);
      res.status(500).json({ error: "Failed to delete run slot" });
    }
  });

  // ========== DELETE ALL RUN SLOTS FOR COMPETITION ==========
  app.delete("/api/competitions/:competitionId/run-slots", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      await storage.deleteRunSlotsByCompetition(competitionId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete run slots error:", error);
      res.status(500).json({ error: "Failed to delete run slots" });
    }
  });

  // ========== GET CONVENTION CLASSES ==========
  app.get("/api/competitions/:competitionId/convention-classes", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      const classes = await storage.getConventionClasses(competitionId);
      res.json(classes);
    } catch (error: any) {
      console.error("Get convention classes error:", error);
      res.status(500).json({ error: "Failed to fetch convention classes" });
    }
  });

  // ========== UPDATE CONVENTION CLASS ==========
  app.patch("/api/convention-classes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const cls = await storage.updateConventionClass(id, req.body);
      
      if (!cls) {
        return res.status(404).json({ error: "Convention class not found" });
      }
      
      res.json(cls);
    } catch (error: any) {
      console.error("Update convention class error:", error);
      res.status(400).json({ error: "Failed to update convention class" });
    }
  });

  // ========== DELETE CONVENTION CLASS ==========
  app.delete("/api/convention-classes/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteConventionClass(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete convention class error:", error);
      res.status(500).json({ error: "Failed to delete convention class" });
    }
  });

  // ========== DELETE ALL CONVENTION CLASSES FOR COMPETITION ==========
  app.delete("/api/competitions/:competitionId/convention-classes", async (req: Request, res: Response) => {
    try {
      const { competitionId } = req.params;
      await storage.deleteConventionClassesByCompetition(competitionId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete convention classes error:", error);
      res.status(500).json({ error: "Failed to delete convention classes" });
    }
  });
}
