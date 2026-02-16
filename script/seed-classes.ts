import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import {
  studioClasses,
  teachers,
  type InsertStudioClass,
  type InsertTeacher,
} from "../server/schema";

type ProgramType = "REC" | "COMP" | "BOTH";

type CanonicalClassSeed = {
  className: string;
  ageGroupLabel: string;
  minAge: number | null;
  maxAge: number | null;
  sessionLabel: string;
  startDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  teacherName: string;
  spotsLeft: number;
  tuitionMonthly: number;
  programType: ProgramType;
  isCompetition: boolean;
};

const CANONICAL_CLASSES: CanonicalClassSeed[] = [
  {
    className: "Acro (Age 2–4)",
    ageGroupLabel: "2–4",
    minAge: 2,
    maxAge: 4,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:00",
    endTime: "17:30",
    room: "Main",
    teacherName: "Kirsten Brown",
    spotsLeft: 4,
    tuitionMonthly: 52.5,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Acro Dance (5–7)",
    ageGroupLabel: "5–7",
    minAge: 5,
    maxAge: 7,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "16:45",
    endTime: "17:30",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 3,
    tuitionMonthly: 57.75,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Acro Dance (8–11)",
    ageGroupLabel: "8–11",
    minAge: 8,
    maxAge: 11,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "18:15",
    endTime: "19:00",
    room: "Main",
    teacherName: "Kirsten Brown",
    spotsLeft: 1,
    tuitionMonthly: 57.75,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Ballet (12-up)",
    ageGroupLabel: "12–20",
    minAge: 12,
    maxAge: 20,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:45",
    endTime: "18:45",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 8,
    tuitionMonthly: 68.25,
    programType: "BOTH",
    isCompetition: true,
  },
  {
    className: "Ballet (8–11)",
    ageGroupLabel: "8–11",
    minAge: 8,
    maxAge: 11,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "18:30",
    endTime: "19:30",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 8,
    tuitionMonthly: 68.25,
    programType: "BOTH",
    isCompetition: true,
  },
  {
    className: "Ballet Barre (5–7)",
    ageGroupLabel: "5–7",
    minAge: 5,
    maxAge: 7,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "16:00",
    endTime: "16:45",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 3,
    tuitionMonthly: 57.75,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Ballet Level 3 (Age 12-up)",
    ageGroupLabel: "12–20",
    minAge: 12,
    maxAge: 20,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "19:30",
    endTime: "21:00",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 4,
    tuitionMonthly: 89.25,
    programType: "COMP",
    isCompetition: true,
  },
  {
    className: "Ballet Tap Jazz (Age 5–7)",
    ageGroupLabel: "5–7",
    minAge: 5,
    maxAge: 7,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:15",
    endTime: "18:15",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 1,
    tuitionMonthly: 68.25,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Hip Hop (5–7)",
    ageGroupLabel: "5–7",
    minAge: 5,
    maxAge: 7,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "18:30",
    endTime: "19:15",
    room: "Main",
    teacherName: "Sample Staff",
    spotsLeft: 1,
    tuitionMonthly: 57.75,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Hip Hop (8–11)",
    ageGroupLabel: "8–11",
    minAge: 8,
    maxAge: 11,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "18:45",
    endTime: "19:30",
    room: "Main",
    teacherName: "Kaylee Stanley",
    spotsLeft: 9,
    tuitionMonthly: 57.75,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Int/Adv Acro Tech",
    ageGroupLabel: "At least 8",
    minAge: 8,
    maxAge: null,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:30",
    endTime: "18:15",
    room: "Main",
    teacherName: "Kirsten Brown",
    spotsLeft: 4,
    tuitionMonthly: 57.75,
    programType: "COMP",
    isCompetition: true,
  },
  {
    className: "Jazz Technique Company Class (11 and up)",
    ageGroupLabel: "11–21",
    minAge: 11,
    maxAge: 21,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "18:15",
    endTime: "19:45",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 11,
    tuitionMonthly: 89.25,
    programType: "COMP",
    isCompetition: true,
  },
  {
    className: "Jazz/Contemporary Combo",
    ageGroupLabel: "8–11",
    minAge: 8,
    maxAge: 11,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "19:00",
    endTime: "20:00",
    room: "Main",
    teacherName: "Kirsten Brown",
    spotsLeft: 4,
    tuitionMonthly: 68.25,
    programType: "BOTH",
    isCompetition: true,
  },
  {
    className: "Mini Rehearsals (Comp Team)",
    ageGroupLabel: "All Ages",
    minAge: null,
    maxAge: null,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:30",
    endTime: "18:30",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 3,
    tuitionMonthly: 68.25,
    programType: "COMP",
    isCompetition: true,
  },
  {
    className: "Open Class (12-up)",
    ageGroupLabel: "12–up",
    minAge: 12,
    maxAge: null,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "19:15",
    endTime: "20:45",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 12,
    tuitionMonthly: 89.25,
    programType: "BOTH",
    isCompetition: true,
  },
  {
    className: "Open Class (8–11)",
    ageGroupLabel: "8–11",
    minAge: 8,
    maxAge: 11,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "16:15",
    endTime: "17:15",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 8,
    tuitionMonthly: 57.75,
    programType: "BOTH",
    isCompetition: true,
  },
  {
    className: "Petite Team Rehearsal",
    ageGroupLabel: "All Ages",
    minAge: null,
    maxAge: null,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "16:00",
    endTime: "16:45",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 4,
    tuitionMonthly: 57.75,
    programType: "COMP",
    isCompetition: true,
  },
  {
    className: "Petite/Jr Jazz Tech (6–7/8–11)",
    ageGroupLabel: "6–11",
    minAge: 6,
    maxAge: 11,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "16:15",
    endTime: "17:15",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 2,
    tuitionMonthly: 68.25,
    programType: "COMP",
    isCompetition: true,
  },
  {
    className: "Preschool Dance (Age 2–4)",
    ageGroupLabel: "2–4",
    minAge: 2,
    maxAge: 4,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:30",
    endTime: "18:00",
    room: "Main",
    teacherName: "Kaylee Stanley",
    spotsLeft: 4,
    tuitionMonthly: 52.5,
    programType: "REC",
    isCompetition: false,
  },
  {
    className: "Strength and Conditioning Comp Team (8–18)",
    ageGroupLabel: "8–18",
    minAge: 8,
    maxAge: 18,
    sessionLabel: "2025–2026",
    startDate: "2025-09-02",
    dayOfWeek: "Wednesday",
    startTime: "17:15",
    endTime: "17:45",
    room: "Main",
    teacherName: "Bethany Sweeney",
    spotsLeft: 3,
    tuitionMonthly: 52.5,
    programType: "COMP",
    isCompetition: true,
  },
];

const CANONICAL_TEACHERS: Record<
  string,
  {
    role: string;
    specialty: string;
    classes: string[];
    isAvailableForSolo: boolean;
  }
> = {
  "Kirsten Brown": {
    role: "Acro Instructor",
    specialty: "Acro, Contemporary",
    classes: ["Acro", "Jazz/Contemporary"],
    isAvailableForSolo: true,
  },
  "Bethany Sweeney": {
    role: "Ballet / Jazz Instructor",
    specialty: "Ballet, Jazz, Technique",
    classes: ["Ballet", "Jazz", "Conditioning"],
    isAvailableForSolo: true,
  },
  "Kaylee Stanley": {
    role: "Hip Hop / Preschool Instructor",
    specialty: "Hip Hop, Preschool",
    classes: ["Hip Hop", "Preschool Dance"],
    isAvailableForSolo: true,
  },
  "Sample Staff": {
    role: "Studio Staff",
    specialty: "General Instruction",
    classes: ["Hip Hop"],
    isAvailableForSolo: false,
  },
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return {
    firstName: firstName || fullName,
    lastName: rest.join(" ") || "Staff",
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

function classSeedId(row: CanonicalClassSeed): string {
  const time = row.startTime.replace(":", "");
  return `seed-class-${slugify(row.className)}-${row.dayOfWeek.toLowerCase()}-${time}`;
}

async function ensureCanonicalTeachers(): Promise<Map<string, string>> {
  const teacherNameToId = new Map<string, string>();

  // Normalize bad historical naming if present.
  const smithRows = await db
    .select()
    .from(teachers)
    .where(and(eq(teachers.firstName, "Kirsten"), eq(teachers.lastName, "Smith")));

  for (const smithTeacher of smithRows) {
    await db
      .update(teachers)
      .set({
        firstName: "Kirsten",
        lastName: "Brown",
        name: "Kirsten Brown",
        role: CANONICAL_TEACHERS["Kirsten Brown"].role,
        specialty: CANONICAL_TEACHERS["Kirsten Brown"].specialty,
        classes: CANONICAL_TEACHERS["Kirsten Brown"].classes,
        isAvailableForSolo: true,
      })
      .where(eq(teachers.id, smithTeacher.id));
  }

  await db
    .update(studioClasses)
    .set({ teacherName: "Kirsten Brown" })
    .where(eq(studioClasses.teacherName, "Kirsten Smith"));

  const existing = await db.select().from(teachers);
  const existingByName = new Map(
    existing.map((teacher) => [
      `${teacher.firstName} ${teacher.lastName}`.trim().toLowerCase(),
      teacher,
    ]),
  );

  for (const [teacherName, teacherMeta] of Object.entries(CANONICAL_TEACHERS)) {
    const key = teacherName.toLowerCase();
    const existingTeacher = existingByName.get(key);

    if (existingTeacher) {
      await db
        .update(teachers)
        .set({
          name: teacherName,
          role: teacherMeta.role,
          specialty: teacherMeta.specialty,
          classes: teacherMeta.classes,
          isAvailableForSolo: teacherMeta.isAvailableForSolo,
          active: true,
        })
        .where(eq(teachers.id, existingTeacher.id));

      teacherNameToId.set(teacherName, existingTeacher.id);
      continue;
    }

    const { firstName, lastName } = splitName(teacherName);
    const teacherInsert: InsertTeacher = {
      firstName,
      lastName,
      name: teacherName,
      role: teacherMeta.role,
      specialty: teacherMeta.specialty,
      classes: teacherMeta.classes,
      isAvailableForSolo: teacherMeta.isAvailableForSolo,
      active: true,
      email: null,
      phone: null,
      avatarUrl: null,
    };

    const [createdTeacher] = await db.insert(teachers).values(teacherInsert).returning();
    teacherNameToId.set(teacherName, createdTeacher.id);
  }

  return teacherNameToId;
}

function mapSeedToInsert(
  row: CanonicalClassSeed,
  teacherId: string | null,
): InsertStudioClass {
  const normalizedCompetition = row.programType !== "REC";

  if (row.isCompetition !== normalizedCompetition) {
    console.warn(
      `⚠️ ${row.className}: isCompetition (${row.isCompetition}) does not match programType (${row.programType}); using derived value ${normalizedCompetition}.`,
    );
  }

  return {
    id: classSeedId(row),

    // Legacy/UI compatibility
    name: row.className,
    level: row.ageGroupLabel,
    day: row.dayOfWeek,
    time: row.startTime,
    type: "Weekly",
    description: `${row.programType} program · ${row.ageGroupLabel}`,
    cost: `$${toMoneyString(row.tuitionMonthly)}/month`,

    // Canonical fields
    className: row.className,
    ageGroupLabel: row.ageGroupLabel,
    minAge: row.minAge,
    maxAge: row.maxAge,
    sessionLabel: row.sessionLabel,
    startDate: row.startDate,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    room: row.room,
    teacherName: row.teacherName,
    spotsLeft: row.spotsLeft,
    tuitionMonthly: toMoneyString(row.tuitionMonthly),
    programType: row.programType,
    isCompetition: normalizedCompetition,

    // FK
    teacherId,
  };
}

async function seedStudioClasses() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run class seeding.");
  }

  const shouldTruncate =
    process.env.SEED_TRUNCATE_CLASSES === "true" && process.env.NODE_ENV !== "production";

  console.log("🌱 Seeding canonical studio class data...");

  if (shouldTruncate) {
    console.log("🧹 Truncating studio_classes for dev/demo reset...");
    await db.delete(studioClasses);
  }

  const teacherNameToId = await ensureCanonicalTeachers();

  let upsertedCount = 0;
  for (const row of CANONICAL_CLASSES) {
    const teacherId = teacherNameToId.get(row.teacherName) || null;
    const values = mapSeedToInsert(row, teacherId);

    await db
      .insert(studioClasses)
      .values(values)
      .onConflictDoUpdate({
        target: studioClasses.id,
        set: {
          name: values.name,
          level: values.level,
          day: values.day,
          time: values.time,
          type: values.type,
          description: values.description,
          cost: values.cost,
          className: values.className,
          ageGroupLabel: values.ageGroupLabel,
          minAge: values.minAge,
          maxAge: values.maxAge,
          sessionLabel: values.sessionLabel,
          startDate: values.startDate,
          dayOfWeek: values.dayOfWeek,
          startTime: values.startTime,
          endTime: values.endTime,
          room: values.room,
          teacherId: values.teacherId,
          teacherName: values.teacherName,
          spotsLeft: values.spotsLeft,
          tuitionMonthly: values.tuitionMonthly,
          programType: values.programType,
          isCompetition: values.isCompetition,
        },
      });

    upsertedCount += 1;
  }

  console.log(`✅ Studio class seed complete. Upserted ${upsertedCount} classes.`);
  console.log("✅ Teacher normalization complete (Kirsten Smith -> Kirsten Brown where applicable).");
}

seedStudioClasses().catch((error) => {
  console.error("❌ Class seeding failed:", error);
  process.exit(1);
});
