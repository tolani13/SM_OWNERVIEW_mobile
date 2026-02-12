// npm install pdf-parse @types/pdf-parse

import { PDFParse } from "pdf-parse";

export type CompetitionInfo = {
  competitionName: string | null;
  city: string | null;
  state: string | null;
  startDate: string | null; // MM/DD/YYYY
  endDate: string | null;   // MM/DD/YYYY
};

const COMP_BRANDS = [
  "Starpower",
  "Showstopper",
  "NexStar",
  "WCDE",
  "Velocity",
  "NUVO",
  "24 Seven",
  "Revive",
  "Jump",
] as const;

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_PATTERN =
  "(?:January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)";

export async function extractCompetitionInfo(pdfBuffer: Buffer): Promise<CompetitionInfo> {
  const emptyResult: CompetitionInfo = {
    competitionName: null,
    city: null,
    state: null,
    startDate: null,
    endDate: null,
  };

  try {
    const parser = new PDFParse(new Uint8Array(pdfBuffer));
    const textResult = await parser.getText();
    const firstPageText = getFirstPageText(textResult?.text ?? "");

    if (!firstPageText.trim()) {
      return emptyResult;
    }

    const competitionName = extractCompetitionName(firstPageText);
    const { city, state } = extractCityAndState(firstPageText);
    const { startDate, endDate } = extractDateRange(firstPageText);

    return {
      competitionName,
      city,
      state,
      startDate,
      endDate,
    };
  } catch {
    return emptyResult;
  }
}

function getFirstPageText(allText: string): string {
  const normalized = allText.replace(/\r\n/g, "\n");

  // Primary splitter from many PDF text extractors.
  const byFormFeed = normalized.split(/\f+/);
  if (byFormFeed[0]?.trim()) {
    return byFormFeed[0].trim();
  }

  // Fallback: basic page marker split if form-feed is absent.
  const byPageDelimiters = normalized.split(/\n\s*(?:-+\s*)?Page\s+\d+(?:\s+of\s+\d+)?\s*(?:-+)?\s*\n/i);
  if (byPageDelimiters[0]?.trim()) {
    return byPageDelimiters[0].trim();
  }

  return normalized.trim();
}

function extractCompetitionName(firstPageText: string): string | null {
  for (const brand of COMP_BRANDS) {
    const brandRegex = new RegExp(`\\b${escapeRegExp(brand)}\\b`, "i");
    if (brandRegex.test(firstPageText)) {
      return brand;
    }
  }

  const lines = firstPageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (isAllCapsLine(line)) {
      return toTitleCase(line);
    }
  }

  return null;
}

function extractCityAndState(firstPageText: string): { city: string | null; state: string | null } {
  const regex = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*),\s*([A-Z]{2})\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(firstPageText)) !== null) {
    const city = match[1]?.trim() ?? "";
    const state = match[2]?.trim().toUpperCase() ?? "";

    if (city && US_STATE_CODES.has(state)) {
      return { city, state };
    }
  }

  return { city: null, state: null };
}

function extractDateRange(firstPageText: string): { startDate: string | null; endDate: string | null } {
  // 1) MM/DD/YYYY - MM/DD/YYYY
  const numericRangeMatch = firstPageText.match(
    /(\b\d{1,2}\/\d{1,2}\/\d{4}\b)\s*-\s*(\b\d{1,2}\/\d{1,2}\/\d{4}\b)/,
  );

  if (numericRangeMatch) {
    const start = parseNumericDate(numericRangeMatch[1]);
    const end = parseNumericDate(numericRangeMatch[2]);
    if (start && end) {
      return { startDate: formatAsMMDDYYYY(start), endDate: formatAsMMDDYYYY(end) };
    }
  }

  // 2) Month D - D, YYYY
  const monthRangeRegex = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})\\s*-\\s*(\\d{1,2}),\\s*(\\d{4})\\b`, "i");
  const monthRangeMatch = firstPageText.match(monthRangeRegex);

  if (monthRangeMatch) {
    const monthName = monthRangeMatch[1];
    const startDay = Number(monthRangeMatch[2]);
    const endDay = Number(monthRangeMatch[3]);
    const year = Number(monthRangeMatch[4]);

    const start = parseMonthNameDate(monthName, startDay, year);
    const end = parseMonthNameDate(monthName, endDay, year);

    if (start && end) {
      return { startDate: formatAsMMDDYYYY(start), endDate: formatAsMMDDYYYY(end) };
    }
  }

  // 3) Month D, YYYY
  const singleMonthRegex = new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2}),\\s*(\\d{4})\\b`, "i");
  const singleMonthMatch = firstPageText.match(singleMonthRegex);

  if (singleMonthMatch) {
    const monthName = singleMonthMatch[1];
    const day = Number(singleMonthMatch[2]);
    const year = Number(singleMonthMatch[3]);
    const date = parseMonthNameDate(monthName, day, year);

    if (date) {
      const formatted = formatAsMMDDYYYY(date);
      return { startDate: formatted, endDate: formatted };
    }
  }

  return { startDate: null, endDate: null };
}

function parseNumericDate(value: string): Date | null {
  const parts = value.split("/");
  if (parts.length !== 3) return null;

  const month = Number(parts[0]);
  const day = Number(parts[1]);
  const year = Number(parts[2]);

  if (!Number.isInteger(month) || !Number.isInteger(day) || !Number.isInteger(year)) {
    return null;
  }

  return makeValidDate(year, month - 1, day);
}

function parseMonthNameDate(monthName: string, day: number, year: number): Date | null {
  const monthIndex = MONTH_MAP[monthName.toLowerCase()];
  if (monthIndex === undefined) {
    return null;
  }

  return makeValidDate(year, monthIndex, day);
}

function makeValidDate(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(year, monthIndex, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatAsMMDDYYYY(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
}

function isAllCapsLine(line: string): boolean {
  if (line.length < 4) return false;
  if (!/[A-Z]/.test(line)) return false;
  if (/[a-z]/.test(line)) return false;
  return /^[A-Z0-9\s'&().:\-/]+$/.test(line);
}

function toTitleCase(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim().toLowerCase();
  return cleaned.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
