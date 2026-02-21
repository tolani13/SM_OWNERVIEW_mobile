import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { registerAccountingRoutes } from "./accounting-routes";
import { registerPDFParserRoutes } from "./pdf-parser-routes";
import { registerRunSheetRoutes } from "./run-sheet-routes";
import { z } from "zod";
import type {
  InsertDancer,
  InsertTeacher,
  InsertRoutine,
  InsertCompetition,
  InsertCompetitionRegistration,
  InsertRunSlot,
  InsertConventionClass,
  InsertStudioClass,
  InsertPracticeBooking,
  InsertAnnouncement,
  InsertMessage,
  InsertChatThread,
  InsertChatThreadParticipant,
  InsertChatMessage,
  InsertChatMessageRead,
  InsertFee,
  InsertPolicy,
  InsertPolicyAgreement,
  DancerLevel,
  EventType,
  EventFeeStatus,
  FeeType,
} from "./schema";

type ActorRole = "owner" | "manager" | "staff" | "parent";

function getActor(req: any): { id: string; name: string; role: ActorRole } {
  const role = (req.headers["x-user-role"] || "owner") as ActorRole;
  return {
    id: (req.headers["x-user-id"] as string) || "owner-1",
    name: (req.headers["x-user-name"] as string) || "Studio Owner",
    role: ["owner", "manager", "staff", "parent"].includes(role) ? role : "owner",
  };
}

function isStudioStaff(role: string): boolean {
  return role === "owner" || role === "manager" || role === "staff";
}

function canCreateCompChat(role: ActorRole): boolean {
  return role === "owner" || role === "manager";
}

const DEFAULT_STUDIO_COMPCHAT_RECIPIENTS: Array<{
  participantId: string;
  participantName: string;
  participantRole: ActorRole;
}> = [
  { participantId: "owner-1", participantName: "Studio Owner", participantRole: "owner" },
  { participantId: "manager-1", participantName: "Studio Manager", participantRole: "manager" },
  { participantId: "staff-1", participantName: "Front Desk Staff", participantRole: "staff" },
  { participantId: "parent-1", participantName: "Parent User", participantRole: "parent" },
];

const CLASS_PROGRAM_TYPES = ["REC", "COMP", "BOTH"] as const;
type ClassProgramType = (typeof CLASS_PROGRAM_TYPES)[number];
const DANCER_LEVEL_OPTIONS = ["mini", "junior", "teen", "senior", "elite"] as const;
const FEE_TYPE_OPTIONS = ["tuition", "costume", "competition", "recital", "other"] as const;
type FeeTypeOption = (typeof FEE_TYPE_OPTIONS)[number];
const EVENT_TYPE_OPTIONS = ["competition", "nationals", "recital", "other"] as const;
const EVENT_PAYMENT_STATUS_OPTIONS = ["paid", "unpaid", "partial"] as const;

const TUITION_RATES_BY_LEVEL: Record<string, number> = {
  mini: 120,
  junior: 150,
  teen: 175,
  senior: 200,
  elite: 225,
};

function parseCurrency(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeFeeType(value: unknown, fallbackType?: unknown): FeeTypeOption {
  const pick = (candidate: unknown): FeeTypeOption | null => {
    if (typeof candidate !== "string") return null;
    const normalized = candidate.trim().toLowerCase();
    return FEE_TYPE_OPTIONS.find((opt) => opt === normalized) ?? null;
  };

  const direct = pick(value);
  if (direct) return direct;

  const legacy = pick(fallbackType);
  if (legacy) return legacy;

  return "other";
}

function normalizeDancerLevel(value: unknown): DancerLevel | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toLowerCase();
  return DANCER_LEVEL_OPTIONS.find((level) => level === trimmed) as DancerLevel | undefined;
}

function normalizeBooleanParam(value: unknown): boolean | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function normalizeSortBy(value: unknown): "lastName" | "age" | "level" | "balance" {
  if (value === "age" || value === "level" || value === "balance") return value;
  return "lastName";
}

function normalizeSortDir(value: unknown): "asc" | "desc" {
  return value === "desc" ? "desc" : "asc";
}

function normalizeEventType(value: unknown): EventType {
  if (typeof value !== "string") return "other";
  const normalized = value.trim().toLowerCase();
  return (EVENT_TYPE_OPTIONS.find((opt) => opt === normalized) as EventType | undefined) ?? "other";
}

function normalizeEventPaymentStatus(value: unknown): "paid" | "unpaid" | "partial" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return EVENT_PAYMENT_STATUS_OPTIONS.find((opt) => opt === normalized) as "paid" | "unpaid" | "partial" | undefined;
}

function normalizeEventFeeStatus(value: unknown): EventFeeStatus {
  if (typeof value !== "string") return "unbilled";
  const normalized = value.trim().toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "partial") return "partial";
  if (normalized === "billed") return "billed";
  return "unbilled";
}

function normalizeFeeTypeParam(value: unknown): FeeType {
  if (typeof value !== "string") return "other";
  const normalized = value.trim().toLowerCase();
  return (FEE_TYPE_OPTIONS.find((opt) => opt === normalized) as FeeType | undefined) ?? "other";
}

function validateDancerPayload(
  payload: Partial<InsertDancer>,
  mode: "create" | "update",
): { ok: true; data: Partial<InsertDancer> } | { ok: false; error: string } {
  const data: Partial<InsertDancer> = { ...payload };

  const hasAge = Object.prototype.hasOwnProperty.call(payload, "age");
  const hasLevel = Object.prototype.hasOwnProperty.call(payload, "level");

  if (mode === "create" || hasAge) {
    const parsedAge =
      typeof payload.age === "number"
        ? payload.age
        : typeof payload.age === "string"
          ? Number(payload.age)
          : Number.NaN;

    if (!Number.isInteger(parsedAge) || parsedAge < 2 || parsedAge > 25) {
      return { ok: false, error: "Age is required and must be an integer between 2 and 25." };
    }
    data.age = parsedAge;
  }

  if (mode === "create" || hasLevel) {
    const normalizedLevel = normalizeDancerLevel(payload.level);
    if (!normalizedLevel) {
      return { ok: false, error: `Level is required and must be one of: ${DANCER_LEVEL_OPTIONS.join(", ")}.` };
    }
    data.level = normalizedLevel;
  }

  return { ok: true, data };
}

function normalizeProgramType(value: unknown): ClassProgramType {
  const candidate = typeof value === "string" ? value.toUpperCase() : "";
  return (CLASS_PROGRAM_TYPES as readonly string[]).includes(candidate)
    ? (candidate as ClassProgramType)
    : "REC";
}

function parseInteger(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parseMoney(value: unknown, fallback = "0.00"): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;

    const normalized = trimmed.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed.toFixed(2);
  }

  return fallback;
}

function parseTimeTo24Hour(value: unknown, fallback = "00:00"): string {
  if (typeof value !== "string") return fallback;

  const raw = value.trim();
  if (!raw) return fallback;

  // 12-hour format: 1:30 PM / 01:30am
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampmMatch) {
    const hour12 = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2]);
    const period = ampmMatch[3].toUpperCase();

    if (hour12 >= 1 && hour12 <= 12 && minute >= 0 && minute <= 59) {
      let hour24 = hour12 % 12;
      if (period === "PM") hour24 += 12;
      return `${hour24.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    }
  }

  // 24-hour format: HH:mm[:ss]
  const twentyFourHourMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFourHourMatch) {
    const hour = Number(twentyFourHourMatch[1]);
    const minute = Number(twentyFourHourMatch[2]);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    }
  }

  return fallback;
}

function normalizeStudioClassPayload(
  payload: Partial<InsertStudioClass>,
  existing?: Partial<InsertStudioClass>,
  resolvedTeacherName?: string | null,
): InsertStudioClass {
  const className = (
    payload.className ||
    payload.name ||
    existing?.className ||
    existing?.name ||
    "Untitled Class"
  ).trim();
  const dayOfWeek = (payload.dayOfWeek || payload.day || existing?.dayOfWeek || existing?.day || "Wednesday").trim();
  const rawStartTime = (payload.startTime || payload.time || existing?.startTime || existing?.time || "00:00").trim();
  const rawEndTime = (payload.endTime || existing?.endTime || rawStartTime || "00:00").trim();
  const startTime = parseTimeTo24Hour(rawStartTime, "00:00");
  const endTime = parseTimeTo24Hour(rawEndTime, startTime);
  const ageGroupLabel = (
    payload.ageGroupLabel ||
    payload.level ||
    existing?.ageGroupLabel ||
    existing?.level ||
    "All Ages"
  ).trim();
  const programType = normalizeProgramType(payload.programType ?? existing?.programType);
  const tuitionMonthly = parseMoney(
    payload.tuitionMonthly ?? payload.cost ?? existing?.tuitionMonthly ?? existing?.cost,
    "0.00",
  );
  const spotsLeft = parseInteger(payload.spotsLeft ?? existing?.spotsLeft, 0);

  return {
    ...payload,
    name: className,
    className,
    level: (payload.level || ageGroupLabel || "All Levels").trim(),
    ageGroupLabel: ageGroupLabel || "All Ages",
    day: dayOfWeek,
    dayOfWeek,
    time: startTime,
    startTime,
    endTime,
    sessionLabel: (payload.sessionLabel || existing?.sessionLabel || "2025–2026").trim(),
    startDate: (payload.startDate || existing?.startDate || "2025-09-02").trim(),
    room: (payload.room || existing?.room || "Main").trim(),
    type: payload.type || existing?.type || "Weekly",
    description: payload.description ?? existing?.description ?? "",
    cost: payload.cost || existing?.cost || `$${tuitionMonthly}/month`,
    teacherId: payload.teacherId ?? existing?.teacherId ?? null,
    teacherName: resolvedTeacherName || payload.teacherName || existing?.teacherName || null,
    minAge: payload.minAge ?? existing?.minAge ?? null,
    maxAge: payload.maxAge ?? existing?.maxAge ?? null,
    spotsLeft,
    tuitionMonthly,
    programType,
    isCompetition:
      typeof payload.isCompetition === "boolean"
        ? payload.isCompetition
        : programType !== "REC",
  } as InsertStudioClass;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const feeStructureSchema = z.object({
    solo: z.string(),
    duetTrio: z.string(),
    group: z.string(),
    largeGroup: z.string(),
    line: z.string(),
    production: z.string(),
    photoFee: z.string().optional()
  });
  // ========== DANCERS ==========
  app.get("/api/dancers", async (_req, res) => {
    try {
      const dancers = await storage.getDancers();
      res.json(dancers);
    } catch (error: any) {
      console.error("Get dancers error:", error);
      res.status(500).json({ error: "Failed to fetch dancers" });
    }
  });

  app.get("/api/dancers/:id", async (req, res) => {
    try {
      const dancer = await storage.getDancer(req.params.id);
      if (!dancer) {
        return res.status(404).json({ error: "Dancer not found" });
      }
      res.json(dancer);
    } catch (error: any) {
      console.error("Get dancer error:", error);
      res.status(500).json({ error: "Failed to fetch dancer" });
    }
  });

  app.post("/api/dancers", async (req, res) => {
    try {
      const validation = validateDancerPayload(req.body as Partial<InsertDancer>, "create");
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      const dancer = await storage.createDancer(validation.data as InsertDancer);
      res.status(201).json(dancer);
    } catch (error: any) {
      console.error("Create dancer error:", error);
      res.status(400).json({ error: error?.message || "Invalid dancer data" });
    }
  });

  app.patch("/api/dancers/:id", async (req, res) => {
    try {
      const validation = validateDancerPayload(req.body as Partial<InsertDancer>, "update");
      if (!validation.ok) {
        return res.status(400).json({ error: validation.error });
      }

      const dancer = await storage.updateDancer(req.params.id, validation.data);
      if (!dancer) {
        return res.status(404).json({ error: "Dancer not found" });
      }
      res.json(dancer);
    } catch (error: any) {
      console.error("Update dancer error:", error);
      res.status(400).json({ error: "Failed to update dancer" });
    }
  });

  app.delete("/api/dancers/:id", async (req, res) => {
    try {
      await storage.deleteDancer(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete dancer error:", error);
      res.status(500).json({ error: "Failed to delete dancer" });
    }
  });

  // ========== TEACHERS ==========
  app.get("/api/teachers", async (_req, res) => {
    try {
      const teachers = await storage.getTeachers();
      res.json(teachers);
    } catch (error: any) {
      console.error("Get teachers error:", error);
      res.status(500).json({ error: "Failed to fetch teachers" });
    }
  });

  app.post("/api/teachers", async (req, res) => {
    try {
      const teacher = await storage.createTeacher(req.body as InsertTeacher);
      res.status(201).json(teacher);
    } catch (error: any) {
      console.error("Create teacher error:", error);
      res.status(400).json({ error: error?.message || "Invalid teacher data" });
    }
  });

  app.patch("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.updateTeacher(req.params.id, req.body);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }
      res.json(teacher);
    } catch (error: any) {
      console.error("Update teacher error:", error);
      res.status(400).json({ error: "Failed to update teacher" });
    }
  });

  app.delete("/api/teachers/:id", async (req, res) => {
    try {
      const teacher = await storage.getTeacher(req.params.id);
      if (!teacher) {
        return res.status(404).json({ error: "Teacher not found" });
      }

      const linkedClassCount = await storage.countStudioClassesByTeacherId(req.params.id);
      if (linkedClassCount > 0) {
        await storage.detachTeacherFromStudioClasses(req.params.id);
      }

      await storage.deleteTeacher(req.params.id);
      res.status(200).json({
        success: true,
        detachedClasses: linkedClassCount,
      });
    } catch (error: any) {
      console.error("Delete teacher error:", error);
      res.status(500).json({ error: "Failed to delete teacher" });
    }
  });

  // ========== ROUTINES ==========
  app.get("/api/routines", async (_req, res) => {
    try {
      const routines = await storage.getRoutines();
      res.json(routines);
    } catch (error: any) {
      console.error("Get routines error:", error);
      res.status(500).json({ error: "Failed to fetch routines" });
    }
  });

  app.post("/api/routines", async (req, res) => {
    try {
      const routine = await storage.createRoutine(req.body as InsertRoutine);
      
      // Auto-create costume fees for each dancer
      if (routine.costumeFee && parseFloat(routine.costumeFee) > 0 && routine.dancerIds.length > 0) {
        const costumeFeeAmount = routine.costumeFee;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        for (const dancerId of routine.dancerIds) {
          await storage.createFee({
            type: "Costume",
            amount: costumeFeeAmount,
            paid: false,
            dueDate: dueDate.toISOString().split('T')[0],
            dancerId: dancerId,
            routineId: routine.id
          });
        }
      }
      
      res.status(201).json(routine);
    } catch (error: any) {
      console.error("Create routine error:", error);
      res.status(400).json({ error: "Invalid routine data" });
    }
  });

  app.patch("/api/routines/:id", async (req, res) => {
    try {
      const existingRoutine = await storage.getRoutine(req.params.id);
      if (!existingRoutine) {
        return res.status(404).json({ error: "Routine not found" });
      }

      const routine = await storage.updateRoutine(req.params.id, req.body);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }

      // Sync costume fees if dancers or costumeFee changed
      const dancersChanged = req.body.dancerIds && 
        JSON.stringify(req.body.dancerIds.sort()) !== JSON.stringify(existingRoutine.dancerIds.sort());
      const feeChanged = req.body.costumeFee && req.body.costumeFee !== existingRoutine.costumeFee;

      if (dancersChanged || feeChanged) {
        const allFees = await storage.getFees();
        const existingCostumeFees = allFees.filter(f => f.routineId === routine.id && f.type === "Costume");
        
        const currentDancerIds = routine.dancerIds || [];
        const costumeFeeAmount = routine.costumeFee || "0";
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        for (const fee of existingCostumeFees) {
          if (!currentDancerIds.includes(fee.dancerId)) {
            await storage.deleteFee(fee.id);
          }
        }

        if (parseFloat(costumeFeeAmount) > 0) {
          for (const dancerId of currentDancerIds) {
            const existingFee = existingCostumeFees.find(f => f.dancerId === dancerId);
            
            if (existingFee) {
              if (feeChanged) {
                await storage.updateFee(existingFee.id, { amount: costumeFeeAmount });
              }
            } else {
              await storage.createFee({
                type: "Costume",
                amount: costumeFeeAmount,
                paid: false,
                dueDate: dueDate.toISOString().split('T')[0],
                dancerId: dancerId,
                routineId: routine.id
              });
            }
          }
        }
      }

      res.json(routine);
    } catch (error: any) {
      console.error("Update routine error:", error);
      res.status(400).json({ error: "Failed to update routine" });
    }
  });

  app.delete("/api/routines/:id", async (req, res) => {
    try {
      const allFees = await storage.getFees();
      const costumeFees = allFees.filter(f => f.routineId === req.params.id && f.type === "Costume");
      for (const fee of costumeFees) {
        await storage.deleteFee(fee.id);
      }
      
      await storage.deleteRoutine(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete routine error:", error);
      res.status(500).json({ error: "Failed to delete routine" });
    }
  });

  // ========== COMPETITIONS ==========
  app.get("/api/competitions", async (_req, res) => {
    try {
      const allCompetitions = await storage.getCompetitions();
      const competitions = allCompetitions.filter((c) => c.status !== "Deleted");
      res.json(competitions);
    } catch (error: any) {
      console.error("Get competitions error:", error);
      res.status(500).json({ error: "Failed to fetch competitions" });
    }
  });

  app.get("/api/competitions/:id", async (req, res) => {
    try {
      const competition = await storage.getCompetition(req.params.id);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }
      res.json(competition);
    } catch (error: any) {
      console.error("Get competition error:", error);
      res.status(500).json({ error: "Failed to fetch competition" });
    }
  });

  app.post("/api/competitions", async (req, res) => {
    try {
      const competition = await storage.createCompetition(req.body as InsertCompetition);
      res.status(201).json(competition);
    } catch (error: any) {
      console.error("Create competition error:", error);
      res.status(400).json({ error: "Invalid competition data" });
    }
  });

  app.patch("/api/competitions/:id", async (req, res) => {
    try {
      const competition = await storage.updateCompetition(req.params.id, req.body);
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }
      res.json(competition);
    } catch (error: any) {
      console.error("Update competition error:", error);
      res.status(400).json({ error: "Failed to update competition" });
    }
  });

  app.delete("/api/competitions/:id", async (req, res) => {
    try {
      await storage.deleteCompetition(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete competition error:", error);
      res.status(500).json({ error: "Failed to delete competition" });
    }
  });

  // ========== COMPETITION REGISTRATIONS ==========
  app.get("/api/competition-registrations", async (req, res) => {
    try {
      const competitionId = req.query.competitionId as string | undefined;
      const registrations = await storage.getCompetitionRegistrations(competitionId);
      res.json(registrations);
    } catch (error: any) {
      console.error("Get registrations error:", error);
      res.status(500).json({ error: "Failed to fetch registrations" });
    }
  });

  app.post("/api/competition-registrations", async (req, res) => {
    try {
      const payload = req.body as InsertCompetitionRegistration;

      if (!payload.competitionId || !payload.dancerId || !payload.routineId) {
        return res.status(400).json({ error: "competitionId, dancerId, and routineId are required" });
      }

      const existing = await storage.getCompetitionRegistrationByKeys(
        payload.competitionId,
        payload.dancerId,
        payload.routineId,
      );
      if (existing) {
        return res.status(409).json({ error: "Registration already exists" });
      }

      const routine = await storage.getRoutine(payload.routineId);
      if (!routine) {
        return res.status(404).json({ error: "Routine not found" });
      }
      if (!routine.dancerIds?.includes(payload.dancerId)) {
        return res.status(400).json({ error: "Dancer is not assigned to this routine" });
      }

      const registration = await storage.createCompetitionRegistration(payload);
      res.status(201).json(registration);
    } catch (error: any) {
      console.error("Create registration error:", error);
      res.status(400).json({ error: "Invalid registration data" });
    }
  });

  app.delete("/api/competition-registrations/:id", async (req, res) => {
    try {
      await storage.deleteCompetitionRegistration(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete registration error:", error);
      res.status(500).json({ error: "Failed to delete registration" });
    }
  });

  // ========== GENERATE FEES ==========
  app.post("/api/competitions/:id/generate-fees", async (req, res) => {
    try {
      const competitionId = req.params.id;
      const competition = await storage.getCompetition(competitionId);
      
      if (!competition) {
        return res.status(404).json({ error: "Competition not found" });
      }

      // Validate feeStructure shape if provided/overriding
      if (competition.feeStructure) {
        const parsed = feeStructureSchema.safeParse(competition.feeStructure);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid feeStructure on competition", details: parsed.error.flatten() });
        }
      }

      // Prevent duplicate fee generation by clearing previous competition fees first.
      await storage.deleteCompetitionFees(competitionId);

      // Get all registrations for this competition
      const registrations = await storage.getCompetitionRegistrations(competitionId);
      
      // Get all routines to determine type
      const allRoutines = await storage.getRoutines();
      
      // Group registrations by dancer
      const dancerRegistrations: Record<string, typeof registrations> = {};
      for (const reg of registrations) {
        if (!dancerRegistrations[reg.dancerId]) {
          dancerRegistrations[reg.dancerId] = [];
        }
        dancerRegistrations[reg.dancerId].push(reg);
      }

      const feeStructure = competition.feeStructure as {
        solo: string;
        duetTrio: string;
        group: string;
        largeGroup: string;
        line: string;
        production: string;
        photoFee?: string;
      };

      const dueDate = competition.paymentDeadline || competition.startDate;

      // Create fees for each dancer
      for (const [dancerId, regs] of Object.entries(dancerRegistrations)) {
        // Create convention fee (one per dancer)
        if (competition.conventionFee && parseFloat(competition.conventionFee) > 0) {
          await storage.createFee({
            type: "Competition",
            amount: competition.conventionFee,
            paid: false,
            dueDate: dueDate,
            dancerId: dancerId,
            competitionId: competitionId,
            routineId: undefined
          });
        }

        // Create entry fee for each routine
        for (const reg of regs) {
          const routine = allRoutines.find(r => r.id === reg.routineId);
          if (!routine) continue;

          let feeAmount = "0";
          const routineType = routine.type;

          if (routineType === "Solo") feeAmount = feeStructure.solo;
          else if (routineType === "Duet" || routineType === "Trio") feeAmount = feeStructure.duetTrio;
          else if (routineType === "Small Group") feeAmount = feeStructure.group;
          else if (routineType === "Large Group") feeAmount = feeStructure.largeGroup;
          else if (routineType === "Line") feeAmount = feeStructure.line;
          else if (routineType === "Production") feeAmount = feeStructure.production;

          if (parseFloat(feeAmount) > 0) {
            await storage.createFee({
              type: "Competition",
              amount: feeAmount,
              paid: false,
              dueDate: dueDate,
              dancerId: dancerId,
              competitionId: competitionId,
              routineId: reg.routineId
            });
          }
        }

        // Create photo fee if applicable (one per dancer)
        if (feeStructure.photoFee && parseFloat(feeStructure.photoFee) > 0) {
          await storage.createFee({
            type: "Competition",
            amount: feeStructure.photoFee,
            paid: false,
            dueDate: dueDate,
            dancerId: dancerId,
            competitionId: competitionId,
            routineId: undefined
          });
        }
      }

      res.json({ success: true, message: "Fees generated successfully" });
    } catch (error: any) {
      console.error("Generate fees error:", error);
      res.status(500).json({ error: "Failed to generate fees" });
    }
  });

  // ========== RUN SLOTS ==========
  app.get("/api/run-slots", async (req, res) => {
    try {
      const competitionId = req.query.competitionId as string | undefined;
      const runSlots = await storage.getRunSlots(competitionId);
      res.json(runSlots);
    } catch (error: any) {
      console.error("Get run slots error:", error);
      res.status(500).json({ error: "Failed to fetch run slots" });
    }
  });

  app.post("/api/run-slots", async (req, res) => {
    try {
      const runSlot = await storage.createRunSlot(req.body as InsertRunSlot);
      res.status(201).json(runSlot);
    } catch (error: any) {
      console.error("Create run slot error:", error);
      res.status(400).json({ error: "Invalid run slot data" });
    }
  });

  app.patch("/api/run-slots/:id", async (req, res) => {
    try {
      const runSlot = await storage.updateRunSlot(req.params.id, req.body);
      if (!runSlot) {
        return res.status(404).json({ error: "Run slot not found" });
      }
      res.json(runSlot);
    } catch (error: any) {
      console.error("Update run slot error:", error);
      res.status(400).json({ error: "Failed to update run slot" });
    }
  });

  app.delete("/api/run-slots/:id", async (req, res) => {
    try {
      await storage.deleteRunSlot(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete run slot error:", error);
      res.status(500).json({ error: "Failed to delete run slot" });
    }
  });

  // ========== CONVENTION CLASSES ==========
  app.get("/api/convention-classes", async (req, res) => {
    try {
      const competitionId = req.query.competitionId as string | undefined;
      const classes = await storage.getConventionClasses(competitionId);
      res.json(classes);
    } catch (error: any) {
      console.error("Get convention classes error:", error);
      res.status(500).json({ error: "Failed to fetch convention classes" });
    }
  });

  app.post("/api/convention-classes", async (req, res) => {
    try {
      const conventionClass = await storage.createConventionClass(req.body as InsertConventionClass);
      res.status(201).json(conventionClass);
    } catch (error: any) {
      console.error("Create convention class error:", error);
      res.status(400).json({ error: "Invalid convention class data" });
    }
  });

  app.patch("/api/convention-classes/:id", async (req, res) => {
    try {
      const conventionClass = await storage.updateConventionClass(req.params.id, req.body);
      if (!conventionClass) {
        return res.status(404).json({ error: "Convention class not found" });
      }
      res.json(conventionClass);
    } catch (error: any) {
      console.error("Update convention class error:", error);
      res.status(400).json({ error: "Failed to update convention class" });
    }
  });

  app.delete("/api/convention-classes/:id", async (req, res) => {
    try {
      await storage.deleteConventionClass(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete convention class error:", error);
      res.status(500).json({ error: "Failed to delete convention class" });
    }
  });

  // ========== STUDIO CLASSES ==========
  app.get("/api/studio-classes", async (_req, res) => {
    try {
      const classes = await storage.getStudioClasses();
      res.json(classes);
    } catch (error: any) {
      console.error("Get studio classes error:", error);
      res.status(500).json({ error: "Failed to fetch studio classes" });
    }
  });

  app.get("/api/classes", async (_req, res) => {
    try {
      const classes = await storage.getStudioClasses();
      res.json(classes);
    } catch (error: any) {
      console.error("Get classes error:", error);
      res.status(500).json({ error: "Failed to fetch classes" });
    }
  });

  app.post("/api/studio-classes", async (req, res) => {
    try {
      const payload = req.body as Partial<InsertStudioClass>;
      const teacher = payload.teacherId ? await storage.getTeacher(payload.teacherId) : undefined;
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : payload.teacherName;

      const studioClass = await storage.createStudioClass(
        normalizeStudioClassPayload(payload, undefined, teacherName),
      );
      res.status(201).json(studioClass);
    } catch (error: any) {
      console.error("Create studio class error:", error);
      res.status(400).json({ error: "Invalid studio class data" });
    }
  });

  app.patch("/api/studio-classes/:id", async (req, res) => {
    try {
      const existing = await storage.getStudioClass(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Studio class not found" });
      }

      const payload = req.body as Partial<InsertStudioClass>;
      const teacher = payload.teacherId ? await storage.getTeacher(payload.teacherId) : undefined;
      const teacherName = teacher
        ? `${teacher.firstName} ${teacher.lastName}`
        : payload.teacherName || existing.teacherName;

      const studioClass = await storage.updateStudioClass(
        req.params.id,
        normalizeStudioClassPayload(payload, existing, teacherName),
      );
      if (!studioClass) {
        return res.status(404).json({ error: "Studio class not found" });
      }
      res.json(studioClass);
    } catch (error: any) {
      console.error("Studio class update error:", error);
      res.status(400).json({ error: "Failed to update studio class" });
    }
  });

  app.delete("/api/studio-classes/:id", async (req, res) => {
    try {
      await storage.deleteStudioClass(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete studio class error:", error);
      res.status(500).json({ error: "Failed to delete studio class" });
    }
  });

  // ========== PRACTICE BOOKINGS ==========
  app.get("/api/practice-bookings", async (_req, res) => {
    try {
      const bookings = await storage.getPracticeBookings();
      res.json(bookings);
    } catch (error: any) {
      console.error("Get practice bookings error:", error);
      res.status(500).json({ error: "Failed to fetch practice bookings" });
    }
  });

  app.post("/api/practice-bookings", async (req, res) => {
    try {
      const booking = await storage.createPracticeBooking(req.body as InsertPracticeBooking);
      res.status(201).json(booking);
    } catch (error: any) {
      console.error("Create practice booking error:", error);
      res.status(400).json({ error: "Invalid booking data" });
    }
  });

  app.patch("/api/practice-bookings/:id", async (req, res) => {
    try {
      const booking = await storage.updatePracticeBooking(req.params.id, req.body);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error: any) {
      console.error("Update practice booking error:", error);
      res.status(400).json({ error: "Failed to update booking" });
    }
  });

  app.delete("/api/practice-bookings/:id", async (req, res) => {
    try {
      await storage.deletePracticeBooking(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete practice booking error:", error);
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // ========== ANNOUNCEMENTS ==========
  app.get("/api/announcements", async (_req, res) => {
    try {
      const announcements = await storage.getAnnouncements();
      res.json(announcements);
    } catch (error: any) {
      console.error("Get announcements error:", error);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  app.post("/api/announcements", async (req, res) => {
    try {
      const announcement = await storage.createAnnouncement(req.body as InsertAnnouncement);
      res.status(201).json(announcement);
    } catch (error: any) {
      console.error("Create announcement error:", error);
      res.status(400).json({ error: "Invalid announcement data" });
    }
  });

  app.patch("/api/announcements/:id", async (req, res) => {
    try {
      const announcement = await storage.updateAnnouncement(req.params.id, req.body);
      if (!announcement) {
        return res.status(404).json({ error: "Announcement not found" });
      }
      res.json(announcement);
    } catch (error: any) {
      console.error("Update announcement error:", error);
      res.status(400).json({ error: "Failed to update announcement" });
    }
  });

  app.delete("/api/announcements/:id", async (req, res) => {
    try {
      await storage.deleteAnnouncement(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete announcement error:", error);
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  // ========== POLICIES ==========
  app.get("/api/policies", async (_req, res) => {
    try {
      const allPolicies = await storage.getPolicies();
      res.json(allPolicies);
    } catch (error: any) {
      console.error("Get policies error:", error);
      res.status(500).json({ error: "Failed to fetch policies" });
    }
  });

  app.post("/api/policies", async (req, res) => {
    try {
      const policy = await storage.createPolicy(req.body as InsertPolicy);
      res.status(201).json(policy);
    } catch (error: any) {
      console.error("Create policy error:", error);
      res.status(400).json({ error: error?.message || "Invalid policy data" });
    }
  });

  app.patch("/api/policies/:id", async (req, res) => {
    try {
      const policy = await storage.updatePolicy(req.params.id, req.body);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(policy);
    } catch (error: any) {
      console.error("Update policy error:", error);
      res.status(400).json({ error: "Failed to update policy" });
    }
  });

  // ========== POLICY AGREEMENTS ==========
  app.get("/api/policy-agreements", async (_req, res) => {
    try {
      const allAgreements = await storage.getPolicyAgreements();
      res.json(allAgreements);
    } catch (error: any) {
      console.error("Get policy agreements error:", error);
      res.status(500).json({ error: "Failed to fetch policy agreements" });
    }
  });

  app.post("/api/policy-agreements", async (req, res) => {
    try {
      const agreement = await storage.createPolicyAgreement(req.body as InsertPolicyAgreement);
      res.status(201).json(agreement);
    } catch (error: any) {
      console.error("Create policy agreement error:", error);
      res.status(400).json({ error: error?.message || "Invalid policy agreement data" });
    }
  });

  // ========== MESSAGES ==========
  app.get("/api/messages", async (_req, res) => {
    try {
      const allMessages = await storage.getMessages();
      res.json(allMessages);
    } catch (error: any) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const message = await storage.createMessage(req.body as InsertMessage);
      res.status(201).json(message);
    } catch (error: any) {
      console.error("Create message error:", error);
      res.status(400).json({ error: error?.message || "Invalid message data" });
    }
  });

  app.patch("/api/messages/:id", async (req, res) => {
    try {
      const message = await storage.updateMessage(req.params.id, req.body);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error: any) {
      console.error("Update message error:", error);
      res.status(400).json({ error: "Failed to update message" });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    try {
      await storage.deleteMessage(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete message error:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // ========== CHAT THREADS ==========
  app.get("/api/chat/threads", async (req, res) => {
    try {
      const actor = getActor(req);
      const allThreads = await storage.getChatThreads();

      const visible: typeof allThreads = [];
      for (const thread of allThreads) {
        const participants = await storage.getChatThreadParticipants(thread.id);
        const isParticipant = participants.some((p) => p.participantId === actor.id && p.authorized);
        if (isParticipant || isStudioStaff(actor.role)) {
          visible.push(thread);
        }
      }

      res.json(visible);
    } catch (error: any) {
      console.error("Get chat threads error:", error);
      res.status(500).json({ error: "Failed to fetch chat threads" });
    }
  });

  app.get("/api/chat/threads/:id", async (req, res) => {
    try {
      const thread = await storage.getChatThread(req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const participants = await storage.getChatThreadParticipants(thread.id);
      res.json({ thread, participants });
    } catch (error: any) {
      console.error("Get chat thread detail error:", error);
      res.status(500).json({ error: "Failed to fetch chat thread" });
    }
  });

  app.post("/api/chat/threads", async (req, res) => {
    try {
      const actor = getActor(req);
      const payload = req.body as InsertChatThread & {
        participants?: InsertChatThreadParticipant[];
      };

      if (!payload.title?.trim()) {
        return res.status(400).json({ error: "Thread title is required" });
      }

      const requestedType = payload.type || "direct_parent_staff";
      const staffOnlyBroadcast = !!payload.staffOnlyBroadcast || requestedType === "compchat";
      if (requestedType === "compchat" && !canCreateCompChat(actor.role)) {
        return res.status(403).json({ error: "Only owner/manager can create CompChat broadcasts" });
      }

      if (staffOnlyBroadcast && !isStudioStaff(actor.role)) {
        return res.status(403).json({ error: "Only studio staff can create broadcasts" });
      }

      const thread = await storage.createChatThread({
        title: payload.title.trim(),
        type: requestedType,
        createdById: actor.id,
        createdByName: actor.name,
        createdByRole: actor.role,
        staffOnlyBroadcast,
        isTimeSensitive: !!payload.isTimeSensitive,
        expiresAt: payload.expiresAt || null,
        active: true,
      });

      await storage.addChatThreadParticipant({
        threadId: thread.id,
        participantId: actor.id,
        participantName: actor.name,
        participantRole: actor.role,
        authorized: true,
      });

      for (const participant of payload.participants || []) {
        const existing = await storage.getChatThreadParticipant(thread.id, participant.participantId);
        if (!existing) {
          await storage.addChatThreadParticipant({
            threadId: thread.id,
            participantId: participant.participantId,
            participantName: participant.participantName,
            participantRole: participant.participantRole,
            authorized: participant.authorized ?? true,
          });
        }
      }

      res.status(201).json(thread);
    } catch (error: any) {
      console.error("Create chat thread error:", error);
      res.status(400).json({ error: error?.message || "Failed to create thread" });
    }
  });

  app.post("/api/chat/threads/:id/participants", async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isStudioStaff(actor.role)) {
        return res.status(403).json({ error: "Only studio staff can authorize participants" });
      }

      const thread = await storage.getChatThread(req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      const participant = req.body as InsertChatThreadParticipant;
      if (!participant.participantId || !participant.participantName || !participant.participantRole) {
        return res.status(400).json({ error: "participantId, participantName, participantRole are required" });
      }

      const existing = await storage.getChatThreadParticipant(thread.id, participant.participantId);
      if (existing) return res.json(existing);

      const created = await storage.addChatThreadParticipant({
        threadId: thread.id,
        participantId: participant.participantId,
        participantName: participant.participantName,
        participantRole: participant.participantRole,
        authorized: participant.authorized ?? true,
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Add chat participant error:", error);
      res.status(400).json({ error: error?.message || "Failed to add participant" });
    }
  });

  app.get("/api/chat/threads/:id/messages", async (req, res) => {
    try {
      const thread = await storage.getChatThread(req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });
      const allMessages = await storage.getChatMessages(thread.id);
      res.json(allMessages);
    } catch (error: any) {
      console.error("Get chat messages error:", error);
      res.status(500).json({ error: "Failed to fetch thread messages" });
    }
  });

  app.post("/api/chat/threads/:id/messages", async (req, res) => {
    try {
      const actor = getActor(req);
      const thread = await storage.getChatThread(req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      const participant = await storage.getChatThreadParticipant(thread.id, actor.id);
      if (!participant && !isStudioStaff(actor.role)) {
        return res.status(403).json({ error: "Not authorized in this thread" });
      }

      if (participant && !participant.authorized) {
        return res.status(403).json({ error: "Participant is not authorized" });
      }

      const payload = req.body as InsertChatMessage;
      if (!payload.body?.trim()) {
        return res.status(400).json({ error: "Message body is required" });
      }

      const isStaffBroadcast = !!payload.isStaffBroadcast;
      if (isStaffBroadcast && !(thread.type === "compchat" && canCreateCompChat(actor.role))) {
        return res.status(403).json({ error: "Only owner/manager can send CompChat broadcasts" });
      }

      const message = await storage.createChatMessage({
        threadId: thread.id,
        senderId: actor.id,
        senderName: actor.name,
        senderRole: actor.role,
        body: payload.body.trim(),
        isStaffBroadcast,
      });

      await storage.updateChatThread(thread.id, {});

      res.status(201).json(message);
    } catch (error: any) {
      console.error("Create chat message error:", error);
      res.status(400).json({ error: error?.message || "Failed to create thread message" });
    }
  });

  app.post("/api/chat/messages/:id/read", async (req, res) => {
    try {
      const actor = getActor(req);
      const payload = req.body as Partial<InsertChatMessageRead>;
      const read = await storage.markChatMessageRead({
        messageId: req.params.id,
        readerId: payload.readerId || actor.id,
        readerName: payload.readerName || actor.name,
        readerRole: payload.readerRole || actor.role,
      });
      res.status(201).json(read);
    } catch (error: any) {
      console.error("Mark message read error:", error);
      res.status(400).json({ error: error?.message || "Failed to mark read" });
    }
  });

  app.get("/api/chat/messages/:id/reads", async (req, res) => {
    try {
      const reads = await storage.getChatMessageReads(req.params.id);
      res.json(reads);
    } catch (error: any) {
      console.error("Get message reads error:", error);
      res.status(500).json({ error: "Failed to fetch reads" });
    }
  });

  app.get("/api/chat/threads/:id/read-summary", async (req, res) => {
    try {
      const thread = await storage.getChatThread(req.params.id);
      if (!thread) return res.status(404).json({ error: "Thread not found" });

      const messages = await storage.getChatMessages(thread.id);
      const readSummary: Record<string, { count: number; readers: string[] }> = {};

      for (const message of messages) {
        const reads = await storage.getChatMessageReads(message.id);
        readSummary[message.id] = {
          count: reads.length,
          readers: reads.map((r) => `${r.readerName} (${r.readerRole})`),
        };
      }

      res.json(readSummary);
    } catch (error: any) {
      console.error("Get read summary error:", error);
      res.status(500).json({ error: "Failed to fetch read summary" });
    }
  });

  // ========== FEES ==========
  app.get("/api/fees", async (req, res) => {
    try {
      const dancerId = req.query.dancerId as string | undefined;
      const fees = await storage.getFees(dancerId);
      res.json(fees);
    } catch (error: any) {
      console.error("Get fees error:", error);
      res.status(500).json({ error: "Failed to fetch fees" });
    }
  });

  app.post("/api/fees", async (req, res) => {
    try {
      const payload = req.body as InsertFee & { feeType?: string; accountingCode?: string | null };
      const normalizedPayload: InsertFee = {
        ...payload,
        feeType: normalizeFeeType(payload.feeType, payload.type),
        accountingCode: payload.accountingCode?.trim() || null,
      };

      const fee = await storage.createFee(normalizedPayload);
      res.status(201).json(fee);
    } catch (error: any) {
      console.error("Create fee error:", error);
      res.status(400).json({ error: "Invalid fee data" });
    }
  });

  app.patch("/api/fees/:id", async (req, res) => {
    try {
      const payload = req.body as Partial<InsertFee> & { feeType?: string; accountingCode?: string | null };
      const normalizedPayload: Partial<InsertFee> = { ...payload };

      if (Object.prototype.hasOwnProperty.call(payload, "feeType") || Object.prototype.hasOwnProperty.call(payload, "type")) {
        normalizedPayload.feeType = normalizeFeeType(payload.feeType, payload.type);
      }

      if (Object.prototype.hasOwnProperty.call(payload, "accountingCode")) {
        normalizedPayload.accountingCode = payload.accountingCode?.trim() || null;
      }

      const fee = await storage.updateFee(req.params.id, normalizedPayload);
      if (!fee) {
        return res.status(404).json({ error: "Fee not found" });
      }
      res.json(fee);
    } catch (error: any) {
      console.error("Update fee error:", error);
      res.status(400).json({ error: "Failed to update fee" });
    }
  });

  app.get("/api/finance/dancer-accounts", async (_req, res) => {
    try {
      const [allDancers, allFees] = await Promise.all([storage.getDancers(), storage.getFees()]);

      const accounts = allDancers.map((dancer) => {
        const dancerFees = allFees.filter((fee) => fee.dancerId === dancer.id);
        const totalAmount = dancerFees.reduce((sum, fee) => sum + parseCurrency(fee.amount), 0);
        const paidAmount = dancerFees
          .filter((fee) => fee.paid)
          .reduce((sum, fee) => sum + parseCurrency(fee.amount), 0);

        const level = typeof dancer.level === "string" ? dancer.level : "";
        const monthlyRate = TUITION_RATES_BY_LEVEL[level] ?? 0;

        return {
          dancerId: dancer.id,
          dancerName: `${dancer.firstName} ${dancer.lastName}`,
          level: level || "N/A",
          monthlyRate,
          currentBalance: Number((totalAmount - paidAmount).toFixed(2)),
        };
      });

      res.json(accounts);
    } catch (error: any) {
      console.error("Get dancer accounts error:", error);
      res.status(500).json({ error: "Failed to fetch dancer accounts" });
    }
  });

  app.get("/api/finance/dancers/:dancerId/ledger", async (req, res) => {
    try {
      const dancerId = req.params.dancerId;
      const dancer = await storage.getDancer(dancerId);
      if (!dancer) {
        return res.status(404).json({ error: "Dancer not found" });
      }

      const dancerFees = (await storage.getFees(dancerId)).slice().sort((a, b) => {
        const dateA = Date.parse(a.dueDate || "");
        const dateB = Date.parse(b.dueDate || "");
        return (Number.isFinite(dateA) ? dateA : 0) - (Number.isFinite(dateB) ? dateB : 0);
      });

      let runningBalance = 0;
      const ledger = dancerFees.map((fee) => {
        const amount = parseCurrency(fee.amount);
        const paid = fee.paid ? amount : 0;
        runningBalance += amount - paid;

        const normalizedFeeType = normalizeFeeType((fee as any).feeType, fee.type);

        return {
          id: fee.id,
          date: fee.dueDate,
          type: normalizedFeeType,
          amount: Number(amount.toFixed(2)),
          paid: Number(paid.toFixed(2)),
          balance: Number(runningBalance.toFixed(2)),
          accountingCode: (fee as any).accountingCode ?? null,
        };
      });

      const currentBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
      const lastPaidRow = [...ledger].reverse().find((entry) => entry.paid > 0);

      res.json({
        dancerId,
        dancerName: `${dancer.firstName} ${dancer.lastName}`,
        currentBalance,
        lastPaymentDate: lastPaidRow?.date ?? null,
        entries: ledger,
      });
    } catch (error: any) {
      console.error("Get dancer ledger error:", error);
      res.status(500).json({ error: "Failed to fetch dancer ledger" });
    }
  });

  app.get("/api/finance/dancers", async (req, res) => {
    try {
      const levelParam = (req.query.level ?? (req.query as any)["level[]"]) as string | string[] | undefined;
      const levelsRaw = Array.isArray(levelParam)
        ? levelParam
        : typeof levelParam === "string"
          ? [levelParam]
          : [];

      const levels = levelsRaw
        .flatMap((entry) => entry.split(","))
        .map((entry) => normalizeDancerLevel(entry))
        .filter((entry): entry is DancerLevel => Boolean(entry));

      const isCompetitionDancer = normalizeBooleanParam(req.query.isCompetitionDancer);

      const eventPaymentStatus = normalizeEventPaymentStatus(req.query.eventPaymentStatus);
      const eventId = typeof req.query.eventId === "string" && req.query.eventId.trim()
        ? req.query.eventId
        : undefined;

      const dancers = await storage.getFinanceDancers({
        sortBy: normalizeSortBy(req.query.sortBy),
        sortDir: normalizeSortDir(req.query.sortDir),
        levels: levels.length ? levels : undefined,
        isCompetitionDancer,
        eventId,
        eventPaymentStatus,
      });

      res.json(dancers);
    } catch (error: any) {
      console.error("Get finance dancers error:", error);
      res.status(500).json({ error: "Failed to fetch finance dancers" });
    }
  });

  app.get("/api/finance/dancers/:dancerId/transactions", async (req, res) => {
    try {
      const ledger = await storage.getDancerFinanceLedger(req.params.dancerId);
      if (!ledger) {
        return res.status(404).json({ error: "Dancer not found" });
      }
      res.json(ledger);
    } catch (error: any) {
      console.error("Get finance dancer transactions error:", error);
      res.status(500).json({ error: "Failed to fetch dancer transactions" });
    }
  });

  app.get("/api/finance/events", async (req, res) => {
    try {
      const seasonYear = typeof req.query.seasonYear === "string" ? Number(req.query.seasonYear) : undefined;
      const events = await storage.getEvents(Number.isFinite(seasonYear) ? seasonYear : undefined);
      res.json(events);
    } catch (error: any) {
      console.error("List finance events error:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/finance/events", async (req, res) => {
    try {
      const payload = req.body as {
        name?: string;
        type?: string;
        seasonYear?: number | string;
        dueDate?: string | null;
      };

      if (!payload.name?.trim()) {
        return res.status(400).json({ error: "Event name is required" });
      }

      const seasonYear = typeof payload.seasonYear === "number"
        ? payload.seasonYear
        : Number(payload.seasonYear);

      if (!Number.isFinite(seasonYear)) {
        return res.status(400).json({ error: "seasonYear is required" });
      }

      const event = await storage.createEvent({
        name: payload.name.trim(),
        type: normalizeEventType(payload.type),
        seasonYear: Math.trunc(seasonYear),
        dueDate: payload.dueDate || null,
      });

      res.status(201).json(event);
    } catch (error: any) {
      console.error("Create finance event error:", error);
      res.status(400).json({ error: error?.message || "Failed to create event" });
    }
  });

  app.patch("/api/finance/events/:id", async (req, res) => {
    try {
      const payload = req.body as {
        name?: string;
        type?: string;
        seasonYear?: number | string;
        dueDate?: string | null;
      };

      const updates: Record<string, unknown> = {};

      if (Object.prototype.hasOwnProperty.call(payload, "name")) {
        if (!payload.name?.trim()) {
          return res.status(400).json({ error: "name cannot be empty" });
        }
        updates.name = payload.name.trim();
      }

      if (Object.prototype.hasOwnProperty.call(payload, "type")) {
        updates.type = normalizeEventType(payload.type);
      }

      if (Object.prototype.hasOwnProperty.call(payload, "seasonYear")) {
        const parsedYear = typeof payload.seasonYear === "number"
          ? payload.seasonYear
          : Number(payload.seasonYear);
        if (!Number.isFinite(parsedYear)) {
          return res.status(400).json({ error: "seasonYear must be numeric" });
        }
        updates.seasonYear = Math.trunc(parsedYear);
      }

      if (Object.prototype.hasOwnProperty.call(payload, "dueDate")) {
        updates.dueDate = payload.dueDate || null;
      }

      const event = await storage.updateEvent(req.params.id, updates);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json(event);
    } catch (error: any) {
      console.error("Update finance event error:", error);
      res.status(400).json({ error: error?.message || "Failed to update event" });
    }
  });

  app.post("/api/finance/event-fees", async (req, res) => {
    try {
      const payload = req.body as {
        dancerId?: string;
        eventId?: string;
        amount?: number | string;
        description?: string;
      };

      if (!payload.dancerId || !payload.eventId) {
        return res.status(400).json({ error: "dancerId and eventId are required" });
      }

      const amount = typeof payload.amount === "number" ? payload.amount : Number(payload.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: "amount must be a non-negative number" });
      }

      const result = await storage.createEventFeeWithCharge({
        dancerId: payload.dancerId,
        eventId: payload.eventId,
        amount,
        description: payload.description,
      });

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Create finance event fee error:", error);
      res.status(400).json({ error: error?.message || "Failed to create event fee" });
    }
  });

  app.patch("/api/finance/event-fees/:id", async (req, res) => {
    try {
      const payload = req.body as {
        status?: string;
        amount?: number | string;
        description?: string;
      };

      const existingEventFee = await storage.getEventFee(req.params.id);
      if (!existingEventFee) {
        return res.status(404).json({ error: "Event fee not found" });
      }

      let targetEventFeeId = existingEventFee.id;

      if (Object.prototype.hasOwnProperty.call(payload, "amount")) {
        const amount =
          typeof payload.amount === "number"
            ? payload.amount
            : Number(payload.amount);

        if (!Number.isFinite(amount) || amount < 0) {
          return res.status(400).json({ error: "amount must be a non-negative number" });
        }

        const upsertResult = await storage.createEventFeeWithCharge({
          dancerId: existingEventFee.dancerId,
          eventId: existingEventFee.eventId,
          amount,
          description: payload.description,
        });

        targetEventFeeId = upsertResult.eventFee.id;
      }

      if (Object.prototype.hasOwnProperty.call(payload, "status")) {
        const normalizedStatus = normalizeEventFeeStatus(payload.status);
        const updated = await storage.updateEventFee(targetEventFeeId, { status: normalizedStatus });

        if (normalizedStatus === "paid") {
          const currentBalance = parseCurrency(updated?.balance ?? 0);
          if (currentBalance > 0) {
            await storage.createFinancePayment({
              dancerId: updated?.dancerId || existingEventFee.dancerId,
              amount: currentBalance,
              description: "Manual event fee payoff",
              eventFeeId: targetEventFeeId,
            });
          }
        }
      }

      const refreshed = await storage.getEventFee(targetEventFeeId);
      res.json(refreshed);
    } catch (error: any) {
      console.error("Update finance event fee error:", error);
      res.status(400).json({ error: error?.message || "Failed to update event fee" });
    }
  });

  app.post("/api/finance/payments", async (req, res) => {
    try {
      const payload = req.body as {
        dancerId?: string;
        amount?: number | string;
        date?: string;
        feeType?: string;
        description?: string;
        eventFeeId?: string;
      };

      const amount = typeof payload.amount === "number" ? payload.amount : Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "amount must be greater than zero" });
      }

      if (!payload.dancerId && !payload.eventFeeId) {
        return res.status(400).json({ error: "dancerId or eventFeeId is required" });
      }

      const payment = await storage.createFinancePayment({
        dancerId: payload.dancerId || "",
        amount,
        date: payload.date,
        feeType: normalizeFeeTypeParam(payload.feeType),
        description: payload.description,
        eventFeeId: payload.eventFeeId,
      });

      res.status(201).json(payment);
    } catch (error: any) {
      console.error("Record finance payment error:", error);
      res.status(400).json({ error: error?.message || "Failed to record payment" });
    }
  });

  app.delete("/api/fees/:id", async (req, res) => {
    try {
      await storage.deleteFee(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Delete fee error:", error);
      res.status(500).json({ error: "Failed to delete fee" });
    }
  });

  // ========== PDF PARSER ROUTES (LEGACY) ==========
  registerPDFParserRoutes(app);

  // ========== RUN SHEET ROUTES (NEW SIMPLIFIED APPROACH) ==========
  registerRunSheetRoutes(app);

  // ========== ACCOUNTING INTEGRATION ROUTES (QB + XERO) ==========
  registerAccountingRoutes(app);

  return httpServer;
}
