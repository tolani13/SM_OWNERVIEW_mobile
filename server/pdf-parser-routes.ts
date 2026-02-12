/**
 * PDF Parser API Routes
 * Handles PDF upload, parsing, and schedule management
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawn } from "node:child_process";
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

type PythonParsedConventionRow = {
  class_name?: string;
  instructor?: string;
  room?: string;
  day?: string;
  start_time?: string;
  end_time?: string;
  time?: string;
  track?: string;
  teacher?: string;
  duration?: string | number;
  style?: string;
  division?: string;
  age_range?: string;
  level?: string;
  is_audition_phrase?: string | boolean | number;
  raw_text?: string;
  class_raw?: string;
};

type PythonConventionParserVendor = "wcde" | "velocity";

const CONVENTION_PARSER_CONFIG: Record<
  PythonConventionParserVendor,
  {
    scriptPath: string;
    functionName: string;
    tempPrefix: string;
    companyLabel: string;
  }
> = {
  wcde: {
    scriptPath: "parse_wcde_convention.py",
    functionName: "parse_wcde_convention",
    tempPrefix: "wcde-convention-",
    companyLabel: "WCDE",
  },
  velocity: {
    scriptPath: "parse_velocity_convention.py",
    functionName: "parse_velocity_convention",
    tempPrefix: "velocity-convention-",
    companyLabel: "Velocity",
  },
};

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function parseDuration(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : null;
}

function parseBooleanish(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = cleanString(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function detectConventionParserVendor(
  competitionName: string,
  originalFileName?: string,
): PythonConventionParserVendor {
  const normalizedCompetition = cleanString(competitionName).toLowerCase();
  const normalizedFileName = cleanString(originalFileName).toLowerCase();
  if (
    normalizedCompetition.includes("velocity") ||
    normalizedFileName.includes("velocity") ||
    normalizedFileName.includes("concord")
  ) {
    return "velocity";
  }
  return "wcde";
}

function resolveConventionParserOverride(raw: unknown): PythonConventionParserVendor | null {
  const normalized = cleanString(raw).toLowerCase();
  if (normalized === "velocity") return "velocity";
  if (normalized === "wcde") return "wcde";
  return null;
}

function getConventionParserCandidates(
  competitionName: string,
  originalFileName: string,
  parserOverride: PythonConventionParserVendor | null,
): PythonConventionParserVendor[] {
  if (parserOverride) return [parserOverride];
  const detected = detectConventionParserVendor(competitionName, originalFileName);
  const fallback: PythonConventionParserVendor = detected === "wcde" ? "velocity" : "wcde";
  return [detected, fallback];
}

function inferConventionStyle(className: string): string | null {
  const normalized = cleanString(className).toLowerCase().replace(/-/g, " ");
  if (!normalized) return null;

  if (normalized.includes("hip hop")) return "Hip Hop";
  if (normalized.includes("musical")) return "Musical Theatre";
  if (normalized.includes("contemporary")) return "Contemporary";
  if (normalized.includes("lyrical")) return "Lyrical";
  if (normalized.includes("jazz")) return "Jazz";
  if (normalized.includes("tap")) return "Tap";
  if (normalized.includes("ballet")) return "Ballet";
  if (normalized.includes("acro")) return "Acro";
  if (normalized.includes("open")) return "Open";
  return null;
}

function parseTimeToMinutes(value: string): number | null {
  const text = cleanString(value).toUpperCase();
  if (!text) return null;

  const match = text.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === "PM") hour += 12;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToHHMM(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeTime(value: unknown): string {
  const cleaned = cleanString(value);
  if (!cleaned) return "";

  const minutes = parseTimeToMinutes(cleaned);
  if (minutes === null) return cleaned;
  return minutesToHHMM(minutes);
}

function deriveEndTimeAndDuration(
  startTime: string,
  explicitEndTime: string,
  durationCandidate: number | null,
): { endTime: string; duration: number | null } {
  const startMinutes = parseTimeToMinutes(startTime);
  const explicitEndMinutes = parseTimeToMinutes(explicitEndTime);

  if (startMinutes !== null && explicitEndMinutes !== null) {
    let duration = explicitEndMinutes - startMinutes;
    if (duration <= 0) duration += 12 * 60;
    return {
      endTime: minutesToHHMM(startMinutes + duration),
      duration,
    };
  }

  if (startMinutes !== null && durationCandidate !== null && durationCandidate > 0) {
    return {
      endTime: minutesToHHMM(startMinutes + durationCandidate),
      duration: durationCandidate,
    };
  }

  if (startMinutes !== null) {
    const fallbackDuration = 60;
    return {
      endTime: minutesToHHMM(startMinutes + fallbackDuration),
      duration: durationCandidate,
    };
  }

  if (explicitEndTime) {
    return {
      endTime: explicitEndTime,
      duration: durationCandidate,
    };
  }

  return {
    endTime: "",
    duration: durationCandidate,
  };
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

async function extractConventionClassesWithPython(
  pdfBuffer: Buffer,
  parserVendor: PythonConventionParserVendor,
): Promise<InsertConventionClass[]> {
  const parserConfig = CONVENTION_PARSER_CONFIG[parserVendor];
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
      throw new Error("Python convention parser returned no output.");
    }

    let parsedRows: PythonParsedConventionRow[] = [];
    try {
      const json = JSON.parse(output);
      if (!Array.isArray(json)) {
        throw new Error("Parser output is not an array.");
      }
      parsedRows = json as PythonParsedConventionRow[];
    } catch (error) {
      throw new Error(`Failed to parse Python output as JSON: ${(error as Error).message}`);
    }

    return parsedRows
      .map((row) => {
        const className = cleanString(row.class_name) || cleanString(row.style);
        const startTime = normalizeTime(row.start_time || row.time);
        const explicitEndTime = normalizeTime(row.end_time);
        const durationCandidate = parseDuration(row.duration);
        const { endTime, duration } = deriveEndTimeAndDuration(startTime, explicitEndTime, durationCandidate);

        const styleCandidate = cleanString(row.style);
        const inferredStyle = styleCandidate && styleCandidate !== className
          ? styleCandidate
          : inferConventionStyle(className);

        const divisionCandidate = cleanString(row.division) || cleanString(row.track);
        const roomCandidate = cleanString(row.room) || cleanString(row.track);
        const rawText = cleanString(row.raw_text) || cleanString(row.class_raw);

        return {
          competitionId: "", // Set at route level
          className,
          instructor: cleanString(row.instructor) || cleanString(row.teacher) || "TBD",
          room: roomCandidate || "Main Ballroom",
          day: cleanString(row.day) || "Saturday",
          startTime,
          endTime,
          duration,
          style: inferredStyle || null,
          division: divisionCandidate || null,
          ageRange: cleanString(row.age_range) || null,
          level: cleanString(row.level) || "All Levels",
          isAuditionPhrase: parseBooleanish(row.is_audition_phrase) || className.toLowerCase().includes("audition"),
          rawText: rawText || null,
        };
      })
      .filter((row) => row.className && row.startTime && row.endTime);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
      // Ignore temp cleanup failures
    });
  }
}

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

      // Convention classes: force Python parser path (same pattern as run-sheet)
      if (String(type || "").toLowerCase() === "convention") {
        const parserOverride =
          resolveConventionParserOverride(req.body?.parser) ||
          resolveConventionParserOverride(req.query?.parser);
        const parserCandidates = getConventionParserCandidates(
          competition.name,
          file.originalname,
          parserOverride,
        );

        let parserVendor: PythonConventionParserVendor | null = null;
        let parsedClasses: InsertConventionClass[] | null = null;
        const parserErrors: string[] = [];

        for (const candidate of parserCandidates) {
          try {
            parsedClasses = await extractConventionClassesWithPython(file.buffer, candidate);
            parserVendor = candidate;
            break;
          } catch (error: any) {
            parserErrors.push(`[${candidate}] ${error?.message || String(error)}`);
          }
        }

        if (!parserVendor || !parsedClasses) {
          throw new Error(parserErrors.join(" | ") || "All convention parsers failed.");
        }

        const parserConfig = CONVENTION_PARSER_CONFIG[parserVendor];
        const usedFallback = !parserOverride && parserCandidates.length > 1 && parserVendor !== parserCandidates[0];

        // Replace existing convention classes for this competition on each import.
        await storage.deleteConventionClassesByCompetition(competitionId);

        const dbData: InsertConventionClass[] = parsedClasses.map((cls) => ({
          ...cls,
          competitionId,
        }));

        const saved = await storage.createConventionClassesBulk(dbData);

        return res.status(201).json({
          success: true,
          type: "convention",
          company: parserConfig.companyLabel,
          parser: "python",
          parserVendor,
          savedCount: saved.length,
          totalParsed: parsedClasses.length,
          warnings: [
            ...(usedFallback ? [`Primary parser failed; imported with ${parserConfig.companyLabel} parser.`] : []),
            ...(saved.length === 0 ? [`${parserConfig.companyLabel} parser returned no convention classes.`] : []),
          ],
          metadata: {
            methodUsed: "python",
            parserVendor,
            fileName: file.originalname,
          },
        });
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
