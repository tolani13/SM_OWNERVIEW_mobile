import type { InsertCompetitionRunSheet } from "../schema";

export type PythonParsedCompetitionRow = {
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

export type PythonCompetitionParserVendor = "wcde" | "velocity" | "hollywood_vibe";

type NormalizedRunSheetRow = Omit<InsertCompetitionRunSheet, "competitionId">;

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
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

export function normalizePythonCompetitionRow(
  row: PythonParsedCompetitionRow,
  parserVendor: PythonCompetitionParserVendor,
): NormalizedRunSheetRow | null {
  const entryNumber = cleanString(row.entry_num);
  if (!entryNumber || !/^\d+$/.test(entryNumber)) {
    return null;
  }

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
    entryNumber,
    routineName: danceName || "Unknown Routine",
    division: cleanString(row.division) || inferDivisionFromCategory(category) || "Unknown",
    // Intentionally preserve parser output for these fields (no category inference here)
    style: cleanString(row.style),
    groupSize: cleanString(row.group_size),
    studioName: cleanString(row.studio) || "Unknown Studio",
    performanceTime: extractPerformanceTime(rawPerformanceTime) || "TBD",
    day: derivedDay || null,
    notes: notes.length ? notes.join(" | ") : null,
    placement: null,
    award: null,
  };
}

export function normalizePythonCompetitionRows(
  rows: PythonParsedCompetitionRow[],
  parserVendor: PythonCompetitionParserVendor,
): NormalizedRunSheetRow[] {
  return rows
    .map((row) => normalizePythonCompetitionRow(row, parserVendor))
    .filter((row): row is NormalizedRunSheetRow => Boolean(row));
}
