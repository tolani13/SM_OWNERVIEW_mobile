/**
 * Competition Run Sheet API Routes
 * Simple PDF import and editable table management
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
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

type PythonParsedCompetitionRow = {
  entry_num?: string;
  dance_name?: string;
  routine_name?: string;
  day?: string;
  category?: string;
  division?: string;
  style?: string;
  group_size?: string;
  studio?: string;
  performers?: string;
  dancers?: string;
  time?: string;
  perf_datetime?: string;
  choreographer?: string;
  segment_date?: string;
  segment_stage?: string;
  segment_header?: string;
};

type PythonCompetitionParserVendor = "wcde" | "velocity" | "hollywood_vibe";

const RUN_SHEET_PARSER_CONFIG: Record<
  PythonCompetitionParserVendor,
  {
    scriptPath: string;
    functionName: string;
    tempPrefix: string;
    companyLabel: string;
  }
> = {
  wcde: {
    scriptPath: "parse_wcde_comp.py",
    functionName: "parse_wcde_comp",
    tempPrefix: "wcde-run-sheet-",
    companyLabel: "WCDE",
  },
  velocity: {
    scriptPath: "parse_velocity_comp.py",
    functionName: "parse_velocity_comp",
    tempPrefix: "velocity-run-sheet-",
    companyLabel: "Velocity",
  },
  hollywood_vibe: {
    scriptPath: "parse_hollywood_vibe_comp.py",
    functionName: "parse_hollywood_vibe_comp",
    tempPrefix: "hollywood-vibe-run-sheet-",
    companyLabel: "Hollywood Vibe",
  },
};

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function detectRunSheetParserVendor(
  competitionName: string,
  originalFileName?: string,
): PythonCompetitionParserVendor {
  const normalizedCompetition = cleanString(competitionName).toLowerCase();
  const normalizedFileName = cleanString(originalFileName).toLowerCase();

  const isHollywoodVibe =
    normalizedCompetition.includes("hollywood vibe") ||
    normalizedCompetition.includes("hollywoodvibe") ||
    ((normalizedCompetition.includes("hollywood") || normalizedFileName.includes("hollywood")) &&
      (normalizedCompetition.includes("vibe") || normalizedFileName.includes("vibe")));

  if (isHollywoodVibe) {
    return "hollywood_vibe";
  }

  if (
    normalizedCompetition.includes("velocity") ||
    normalizedFileName.includes("velocity") ||
    normalizedFileName.includes("concord")
  ) {
    return "velocity";
  }

  return "wcde";
}

function resolveRunSheetParserOverride(raw: unknown): PythonCompetitionParserVendor | null {
  const normalized = cleanString(raw).toLowerCase();
  const compact = normalized.replace(/[\s_-]+/g, "");
  if (normalized === "velocity") return "velocity";
  if (normalized === "wcde") return "wcde";
  if (
    normalized === "hollywood_vibe" ||
    normalized === "hollywood-vibe" ||
    normalized === "hollywood vibe" ||
    normalized === "hollywoodvibe" ||
    normalized === "hollywood" ||
    compact === "hollywoodvibe"
  ) {
    return "hollywood_vibe";
  }
  return null;
}

function getRunSheetParserCandidates(
  competitionName: string,
  originalFileName: string,
  parserOverride: PythonCompetitionParserVendor | null,
): PythonCompetitionParserVendor[] {
  if (parserOverride) return [parserOverride];

  const detected = detectRunSheetParserVendor(competitionName, originalFileName);
  const fallbackOrder: PythonCompetitionParserVendor[] =
    detected === "hollywood_vibe"
      ? ["hollywood_vibe", "wcde", "velocity"]
      : detected === "velocity"
        ? ["velocity", "wcde", "hollywood_vibe"]
        : ["wcde", "velocity", "hollywood_vibe"];

  return fallbackOrder;
}

function inferDivisionFromCategory(category: string): string {
  const normalized = cleanString(category).toLowerCase();
  if (!normalized) return "";

  if (normalized.includes("mini")) return "Mini";
  if (normalized.includes("junior")) return "Junior";
  if (normalized.includes("intermediate")) return "Intermediate";
  if (normalized.includes("teen")) return "Teen";
  if (normalized.includes("senior")) return "Senior";
  if (normalized.includes("petite") || normalized.includes("tiny")) return "Mini";
  return "";
}

function inferStyleFromCategory(category: string): string {
  const normalized = cleanString(category).toLowerCase().replace(/-/g, " ");
  if (!normalized) return "";

  if (normalized.includes("hip hop")) return "Hip Hop";
  if (normalized.includes("musical")) return "Musical Theatre";
  if (normalized.includes("contemporary")) return "Contemporary";
  if (normalized.includes("lyrical")) return "Lyrical";
  if (normalized.includes("jazz")) return "Jazz";
  if (normalized.includes("tap")) return "Tap";
  if (normalized.includes("ballet")) return "Ballet";
  if (normalized.includes("acro")) return "Acro";
  if (normalized.includes("open")) return "Open";
  return "";
}

function inferGroupSizeFromCategory(category: string): string {
  const normalized = cleanString(category).toLowerCase();
  if (!normalized) return "";

  if (normalized.includes("duo") || normalized.includes("duet") || normalized.includes("trio")) {
    return "Duo/Trio";
  }
  if (normalized.includes("small group")) return "Small Group";
  if (normalized.includes("large group")) return "Large Group";
  if (normalized.includes("line")) return "Line";
  if (normalized.includes("production")) return "Production";
  if (normalized.includes("solo")) return "Solo";
  return "";
}

function extractDayFromText(value: string): string | null {
  const normalized = cleanString(value);
  if (!normalized) return null;

  const dayMatch = normalized.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i,
  );
  if (!dayMatch) return null;

  const token = dayMatch[1].toLowerCase();
  const dayMap: Record<string, string> = {
    mon: "Monday",
    monday: "Monday",
    tue: "Tuesday",
    tuesday: "Tuesday",
    wed: "Wednesday",
    wednesday: "Wednesday",
    thu: "Thursday",
    thursday: "Thursday",
    fri: "Friday",
    friday: "Friday",
    sat: "Saturday",
    saturday: "Saturday",
    sun: "Sunday",
    sunday: "Sunday",
  };

  return dayMap[token] ?? null;
}

function extractPerformanceTime(raw: string): string {
  const normalized = cleanString(raw);
  if (!normalized) return "";

  const amPmMatch = normalized.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
  if (amPmMatch) {
    return amPmMatch[1].replace(/\s+/g, " ").toUpperCase();
  }

  const plainMatch = normalized.match(/\b(\d{1,2}:\d{2})\b/);
  if (plainMatch) {
    return plainMatch[1];
  }

  return normalized;
}

function extractDayFromDate(raw: string): string | null {
  const normalized = cleanString(raw);
  if (!normalized) return null;

  const usMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return null;
    }

    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  if (/[A-Za-z]/.test(normalized)) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", { weekday: "long" });
    }
  }

  return null;
}

function normalizeDayLabel(raw: string): string | null {
  const normalized = cleanString(raw);
  if (!normalized) return null;
  return extractDayFromText(normalized) || extractDayFromDate(normalized);
}

function runPython(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("python", args, {
      cwd: process.cwd(),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start Python: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const details = (stderr || stdout).trim();
      reject(new Error(details || `Python exited with code ${code}`));
    });
  });
}

async function extractRunSheetWithPython(
  pdfBuffer: Buffer,
  parserVendor: PythonCompetitionParserVendor,
): Promise<InsertCompetitionRunSheet[]> {
  const parserConfig = RUN_SHEET_PARSER_CONFIG[parserVendor];
  const parserScriptPath = path.join(process.cwd(), parserConfig.scriptPath);

  try {
    await fs.access(parserScriptPath);
  } catch {
    throw new Error(`Python parser script ${parserConfig.scriptPath} was not found in the project root.`);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), parserConfig.tempPrefix));
  const tempPdfPath = path.join(tempDir, "upload.pdf");

  try {
    await fs.writeFile(tempPdfPath, pdfBuffer);

    const moduleName = path.parse(parserConfig.scriptPath).name;

    const pythonCode = [
      "import sys",
      `from ${moduleName} import ${parserConfig.functionName}`,
      `df = ${parserConfig.functionName}(sys.argv[1]).fillna('')`,
      "print(df.to_json(orient='records'))",
    ].join("\n");

    const { stdout } = await runPython(["-c", pythonCode, tempPdfPath]);
    const output = stdout.trim();

    if (!output) {
      throw new Error("Python parser returned no output.");
    }

    let parsedRows: PythonParsedCompetitionRow[] = [];
    try {
      const json = JSON.parse(output);
      if (!Array.isArray(json)) {
        throw new Error("Parser output is not an array.");
      }
      parsedRows = json as PythonParsedCompetitionRow[];
    } catch (error) {
      throw new Error(`Failed to parse Python output as JSON: ${(error as Error).message}`);
    }

    return parsedRows
      .map((row) => {
        const entryNumber = cleanString(row.entry_num);
        const category = cleanString(row.category);
        const performers = cleanString(row.performers || row.dancers);
        const danceName = cleanString(row.dance_name || row.routine_name);
        const rawPerformanceTime = cleanString(row.time || row.perf_datetime);
        const segmentHeader = cleanString(row.segment_header);
        const segmentDate = cleanString(row.segment_date);
        const segmentStage = cleanString(row.segment_stage);
        const choreographer = cleanString(row.choreographer);
        const explicitDay = cleanString(row.day);

        const derivedDay =
          normalizeDayLabel(explicitDay) ||
          extractDayFromText(segmentHeader) ||
          extractDayFromText(rawPerformanceTime) ||
          extractDayFromDate(segmentDate) ||
          extractDayFromText(segmentDate);

        const notes: string[] = [];
        if (parserVendor === "velocity" && category) {
          notes.push(`Category: ${category}`);
        }
        if (performers) {
          const label = parserVendor === "velocity" ? "Performers" : "Dancers";
          notes.push(`${label}: ${performers}`);
        }
        if (parserVendor === "hollywood_vibe" && choreographer) {
          notes.push(`Choreographer: ${choreographer}`);
        }
        if (parserVendor === "hollywood_vibe" && segmentDate) {
          notes.push(`Segment Date: ${segmentDate}`);
        }
        if (parserVendor === "hollywood_vibe" && segmentStage) {
          notes.push(`Stage: ${segmentStage}`);
        }
        if (parserVendor === "hollywood_vibe" && segmentHeader) {
          notes.push(`Segment: ${segmentHeader}`);
        }
        return {
          competitionId: "", // Set at route level
          entryNumber,
          routineName: danceName || "Unknown Routine",
          division: cleanString(row.division) || inferDivisionFromCategory(category) || "Unknown",
          style: cleanString(row.style) || inferStyleFromCategory(category) || "Unknown",
          groupSize: cleanString(row.group_size) || inferGroupSizeFromCategory(category) || "Unknown",
          studioName: cleanString(row.studio) || "Unknown Studio",
          performanceTime: extractPerformanceTime(rawPerformanceTime) || "TBD",
          day: derivedDay || null,
          notes: notes.length ? notes.join(" | ") : null,
          placement: null,
          award: null,
        };
      })
      .filter((row) => row.entryNumber && /^\d+$/.test(row.entryNumber));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // ignore temp cleanup failures
    });
  }
}

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

      if (!file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      // Verify competition exists
      const competition = await storage.getCompetition(competitionId);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const parserOverride =
        resolveRunSheetParserOverride(req.body?.parser) ||
        resolveRunSheetParserOverride(req.query?.parser);
      const parserCandidates = getRunSheetParserCandidates(
        competition.name,
        file.originalname,
        parserOverride,
      );

      let parserVendor: PythonCompetitionParserVendor | null = null;
      let extractedEntries: InsertCompetitionRunSheet[] | null = null;
      const parserErrors: string[] = [];

      for (const candidate of parserCandidates) {
        try {
          extractedEntries = await extractRunSheetWithPython(file.buffer, candidate);
          parserVendor = candidate;
          break;
        } catch (error: any) {
          parserErrors.push(`[${candidate}] ${error?.message || String(error)}`);
        }
      }

      if (!parserVendor || !extractedEntries) {
        throw new Error(
          parserErrors.join(" | ") || "All run-sheet parsers failed.",
        );
      }

      const parserConfig = RUN_SHEET_PARSER_CONFIG[parserVendor];
      const usedFallback = !parserOverride && parserCandidates.length > 1 && parserVendor !== parserCandidates[0];
      const parserRequested = parserOverride ?? "auto";

      // Always use the Python parser for run-sheet imports.
      const entries = extractedEntries.map((entry) => ({
        ...entry,
        competitionId,
      }));

      return res.status(200).json({
        success: true,
        parser: 'python',
        parserVendor,
        parserRequested,
        company: parserConfig.companyLabel,
        modeRequested: parserRequested,
        entries,
        warnings: [
          ...(usedFallback ? [`Primary parser failed; imported with ${parserConfig.companyLabel} parser.`] : []),
          ...(entries.length === 0 ? [`${parserConfig.companyLabel} parser returned no entries.`] : []),
        ],
        message: `Extracted ${entries.length} entries with ${parserConfig.companyLabel} Python parser. Please review and save.`,
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
