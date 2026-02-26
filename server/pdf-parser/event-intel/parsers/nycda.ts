import type {
  NormalizedConventionScheduleRow,
  NormalizedRunSheetRow,
} from "../types";

/**
 * NYCDA run-sheet parser stub.
 *
 * TODO: Implement brand-specific tokenization/extraction for NYCDA run sheets,
 * then map each parsed entry into NormalizedRunSheetRow.
 */
export function parseNyCdaRunSheet(_pdfText: string): NormalizedRunSheetRow[] {
  return [];
}

/**
 * NYCDA convention schedule parser stub.
 *
 * TODO: Implement room/block/class/faculty extraction for NYCDA schedules,
 * then map each parsed block into NormalizedConventionScheduleRow.
 */
export function parseNyCdaConventionSchedule(
  _pdfText: string,
): NormalizedConventionScheduleRow[] {
  return [];
}
