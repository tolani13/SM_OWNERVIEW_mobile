/**
 * PDF Parser Types for Studio Maestro
 * Handles competition run sheets and convention class schedules
 */

export interface ParsedRunSlot {
  entryNumber?: string;
  routineName: string;
  division: string;
  style: string;
  groupSize: string;
  studioName: string;
  day: string;
  performanceTime: string; // 24hr format HH:MM
  stage?: string;
  orderNumber: number;
  rawText: string;
}

export interface ParsedConventionClass {
  className: string;
  instructor: string;
  room: string;
  day: string;
  startTime: string; // 24hr format HH:MM
  endTime: string; // 24hr format HH:MM
  duration?: number; // minutes
  style?: string;
  division?: string;
  ageRange?: string;
  level?: string;
  isAuditionPhrase?: boolean;
  rawText: string;
}

export interface ParseResult {
  success: boolean;
  type: 'runsheet' | 'convention';
  company: CompanyType;
  data: ParsedRunSlot[] | ParsedConventionClass[];
  errors: string[];
  warnings: string[];
  metadata: {
    parsedAt: Date;
    fileName: string;
    pageCount: number;
    totalEntries: number;
  };
}

export type CompanyType = 'unknown';

export interface ParserStrategy {
  /**
   * Detect if this parser can handle the PDF text
   */
  canParse(text: string): boolean;

  /**
   * Parse run sheet PDF to structured data
   */
  parseRunSheet(text: string): ParsedRunSlot[];

  /**
   * Parse convention schedule PDF to structured data
   */
  parseConvention(text: string): ParsedConventionClass[];

  /**
   * Company identifier
   */
  company: CompanyType;
}

// Validation helpers
export const VALID_DIVISIONS = [
  'Mini',
  'Spark',
  'PreTeen',
  'Junior',
  'Intermediate',
  'Teen',
  'Senior'
] as const;

export const VALID_STYLES = [
  'Ballet',
  'Jazz',
  'Contemporary',
  'Tap',
  'Lyrical',
  'Hip Hop',
  'Musical Theater',
  'Open',
  'Acro',
  'Modern'
] as const;

export const VALID_GROUP_SIZES = [
  'Solo',
  'Duo/Trio',
  'Small Group',
  'Large Group',
  'Line',
  'Production'
] as const;

export type Division = typeof VALID_DIVISIONS[number];
export type Style = typeof VALID_STYLES[number];
export type GroupSize = typeof VALID_GROUP_SIZES[number];
