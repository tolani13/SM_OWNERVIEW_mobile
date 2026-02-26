/**
 * Event Intel parser contracts (Section A - PDF Parsing Pipeline centerpiece)
 */

/**
 * Normalized run-sheet row emitted by brand-specific parsers.
 * Persistence-level fields like id/createdAt/eventId are attached by the service layer.
 */
export interface NormalizedRunSheetRow {
  sessionName?: string | null;
  stageName?: string | null;
  routineNumber?: string | null;
  routineName?: string | null;
  studioName?: string | null;
  division?: string | null;
  age?: string | null;
  level?: string | null;
  category?: string | null;
  scheduledTime?: string | null;
  rawLine?: string | null;
}

/**
 * Normalized convention schedule row emitted by brand-specific parsers.
 * Persistence-level fields like id/createdAt/eventId are attached by the service layer.
 */
export interface NormalizedConventionScheduleRow {
  roomName?: string | null;
  blockLabel?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  classType?: string | null;
  facultyName?: string | null;
  level?: string | null;
}

/**
 * Parsing job lifecycle status for Event Intel ingestion jobs.
 */
export type ParsingJobStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "SCANNED_UNSUPPORTED";

/**
 * Lightweight detector output used by pdfParsingService.
 */
export type DetectedPdfType = "TEXT" | "SCANNED_UNSUPPORTED";
