import type {
  NormalizedConventionScheduleRow,
  NormalizedRunSheetRow,
} from "../types";

const DIVISION_TOKENS = [
  "mini",
  "petite",
  "junior",
  "pre-teen",
  "preteen",
  "teen",
  "senior",
] as const;

const LEVEL_TOKENS = [
  "novice",
  "intermediate",
  "advanced",
  "elite",
  "pro",
  "all levels",
] as const;

const CATEGORY_TOKENS = [
  "contemporary",
  "lyrical",
  "jazz",
  "tap",
  "ballet",
  "hip hop",
  "hip-hop",
  "musical theatre",
  "musical theater",
  "acro",
  "open",
] as const;

const STUDIO_HINT = /\b(studio|dance|academy|company|center|centre|performing|arts|project)\b/i;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCategory(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "hip-hop") return "Hip Hop";
  if (lower === "musical theater") return "Musical Theatre";
  return lower
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findToken(line: string, tokens: readonly string[]): string | null {
  const lower = line.toLowerCase();
  const sorted = [...tokens].sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    const pattern = new RegExp(`\\b${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) return token;
  }
  return null;
}

function extractTime(line: string): string | null {
  const match = line.match(/\b(\d{1,2}:\d{2}(?:\s?(?:AM|PM))?)\b/i);
  return match ? compactWhitespace(match[1].toUpperCase()) : null;
}

function removeKnownParts(line: string, parts: Array<string | null>): string {
  let working = ` ${line} `;
  for (const part of parts) {
    if (!part) continue;
    const escaped = part.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    working = working.replace(new RegExp(`\\b${escaped}\\b`, "ig"), " ");
  }
  working = working.replace(/\b\d{1,2}:\d{2}(?:\s?(?:AM|PM))?\b/gi, " ");
  working = working.replace(/^\s*\d{1,4}\s+/, " ");
  return compactWhitespace(working);
}

function splitRoutineAndStudio(text: string): { routineName: string | null; studioName: string | null } {
  if (!text) return { routineName: null, studioName: null };

  const dashSplit = text.split(/\s[-–]\s/);
  if (dashSplit.length >= 2) {
    const left = compactWhitespace(dashSplit[0]);
    const right = compactWhitespace(dashSplit.slice(1).join(" - "));
    return {
      routineName: left || null,
      studioName: right || null,
    };
  }

  const words = text.split(" ");
  const hintIndex = words.findIndex((w) => STUDIO_HINT.test(w));
  if (hintIndex > 0) {
    return {
      routineName: compactWhitespace(words.slice(0, hintIndex).join(" ")) || null,
      studioName: compactWhitespace(words.slice(hintIndex).join(" ")) || null,
    };
  }

  return { routineName: text || null, studioName: null };
}

/**
 * NYCDA run-sheet parser baseline.
 *
 * Heuristic parser that extracts routine-number-led lines and tokenizes
 * division/level/category/time. Remaining text is split into routine/studio.
 */
export function parseNyCdaRunSheet(pdfText: string): NormalizedRunSheetRow[] {
  const rows: NormalizedRunSheetRow[] = [];
  const lines = pdfText.split(/\r?\n/);

  let currentSession: string | null = null;
  let currentStage: string | null = null;

  for (const raw of lines) {
    const line = compactWhitespace(raw);
    if (!line) continue;

    if (/\b(session|competition starts|block)\b/i.test(line) && !/^\d{1,4}\b/.test(line)) {
      currentSession = line;
      continue;
    }

    if (/\b(stage|ballroom|room)\b/i.test(line) && !/^\d{1,4}\b/.test(line)) {
      currentStage = line;
      continue;
    }

    const numberMatch = line.match(/^\s*(\d{1,4})\b/);
    if (!numberMatch) continue;

    const routineNumber = numberMatch[1];
    const scheduledTime = extractTime(line);
    const division = findToken(line, DIVISION_TOKENS);
    const level = findToken(line, LEVEL_TOKENS);
    const category = normalizeCategory(findToken(line, CATEGORY_TOKENS));

    const remainder = removeKnownParts(line, [routineNumber, division, level, category]);
    const { routineName, studioName } = splitRoutineAndStudio(remainder);

    if (!routineName && !studioName) continue;

    rows.push({
      sessionName: currentSession,
      stageName: currentStage,
      routineNumber,
      routineName,
      studioName,
      division,
      level,
      category,
      scheduledTime,
      rawLine: line,
    });
  }

  return rows;
}

function extractFacultyAndClass(block: string): { classType: string | null; facultyName: string | null } {
  const pipeParts = block.split("|").map((part) => compactWhitespace(part));
  if (pipeParts.length >= 2) {
    return {
      classType: pipeParts[0] || null,
      facultyName: pipeParts.slice(1).join(" ") || null,
    };
  }

  const withSplit = block.split(/\bwith\b/i).map((part) => compactWhitespace(part));
  if (withSplit.length >= 2) {
    return {
      classType: withSplit[0] || null,
      facultyName: withSplit.slice(1).join(" ") || null,
    };
  }

  return {
    classType: block || null,
    facultyName: null,
  };
}

/**
 * NYCDA convention schedule parser baseline.
 *
 * Extracts lines that begin with time ranges and maps class/faculty/room/level.
 */
export function parseNyCdaConventionSchedule(
  pdfText: string,
): NormalizedConventionScheduleRow[] {
  const rows: NormalizedConventionScheduleRow[] = [];
  const lines = pdfText.split(/\r?\n/);

  let currentRoom: string | null = null;
  let currentBlock: string | null = null;

  for (const raw of lines) {
    const line = compactWhitespace(raw);
    if (!line) continue;

    if (/\b(room|ballroom|studio [a-z0-9])\b/i.test(line) && !/\d{1,2}:\d{2}/.test(line)) {
      currentRoom = line;
      continue;
    }

    if (/\b(audition|master class|breakout|scholarship|improv)\b/i.test(line) && !/\d{1,2}:\d{2}/.test(line)) {
      currentBlock = line;
      continue;
    }

    const rangeMatch = line.match(
      /^(\d{1,2}:\d{2}(?:\s?(?:AM|PM))?)\s*[-–]\s*(\d{1,2}:\d{2}(?:\s?(?:AM|PM))?)\s*(.*)$/i,
    );
    if (!rangeMatch) continue;

    const startTime = compactWhitespace(rangeMatch[1].toUpperCase());
    const endTime = compactWhitespace(rangeMatch[2].toUpperCase());
    const payload = compactWhitespace(rangeMatch[3]);
    if (!payload) continue;

    const { classType, facultyName } = extractFacultyAndClass(payload);
    const level = findToken(payload, LEVEL_TOKENS) ?? findToken(payload, DIVISION_TOKENS);

    rows.push({
      roomName: currentRoom,
      blockLabel: currentBlock,
      startTime,
      endTime,
      classType,
      facultyName,
      level,
    });
  }

  return rows;
}
