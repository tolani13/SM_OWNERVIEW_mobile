/**
 * PDF Parser Utilities
 * Shared helpers for time normalization, text cleaning, and validation
 */

import type { Division, Style, GroupSize } from './types';
import { VALID_DIVISIONS, VALID_STYLES, VALID_GROUP_SIZES } from './types';

/**
 * Normalize various time formats to 24hr HH:MM
 * Handles:
 * - "7:00 AM" → "07:00"
 * - "Fri 1:10" → "13:10" (assumes PM for single digit hour > 7)
 * - "7:30-8:30" → "07:30"
 */
export function normalizeTime(timeStr: string): string {
  const trimmed = timeStr.trim();
  
  // Handle "7:00 AM" / "7:00 PM" format
  const amPmMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (amPmMatch) {
    let hour = parseInt(amPmMatch[1]);
    const minute = amPmMatch[2];
    const isPM = amPmMatch[3].toUpperCase() === 'PM';
    
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }
  
  // Handle "Fri 1:10" or "Day HH:MM" format
  const dayMatch = trimmed.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}):(\d{2})/i);
  if (dayMatch) {
    let hour = parseInt(dayMatch[1]);
    const minute = dayMatch[2];
    
    // Assume PM if hour is < 8 (competitions rarely start before 8am)
    if (hour < 8) hour += 12;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }
  
  // Handle time range "7:30-8:30" - return start time
  const rangeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*-/);
  if (rangeMatch) {
    let hour = parseInt(rangeMatch[1]);
    const minute = rangeMatch[2];
    
    // Assume AM for early hours, PM for afternoon
    if (hour < 8) hour += 12;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }
  
  // Handle "8:30AM" (no space)
  const compactMatch = trimmed.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
  if (compactMatch) {
    let hour = parseInt(compactMatch[1]);
    const minute = compactMatch[2];
    const isPM = compactMatch[3].toUpperCase() === 'PM';
    
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }
  
  // Return as-is if already in HH:MM format
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Default fallback - return original
  console.warn(`Unable to normalize time: ${timeStr}`);
  return trimmed;
}

/**
 * Parse time range into start/end times
 * "7:30-8:30 AM" → { start: "07:30", end: "08:30" }
 */
export function parseTimeRange(rangeStr: string): { start: string; end: string; duration: number } | null {
  const trimmed = rangeStr.trim();
  
  // Handle "7:00-8:00 AM" format
  const amPmRangeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (amPmRangeMatch) {
    let startHour = parseInt(amPmRangeMatch[1]);
    const startMin = amPmRangeMatch[2];
    let endHour = parseInt(amPmRangeMatch[3]);
    const endMin = amPmRangeMatch[4];
    const isPM = amPmRangeMatch[5].toUpperCase() === 'PM';
    
    if (isPM) {
      if (startHour !== 12) startHour += 12;
      if (endHour !== 12) endHour += 12;
    } else {
      if (startHour === 12) startHour = 0;
      if (endHour === 12) endHour = 0;
    }
    
    const start = `${startHour.toString().padStart(2, '0')}:${startMin}`;
    const end = `${endHour.toString().padStart(2, '0')}:${endMin}`;
    const duration = calculateDuration(start, end);
    
    return { start, end, duration };
  }
  
  // Handle "7:30-8:30" without AM/PM
  const simpleRangeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (simpleRangeMatch) {
    let startHour = parseInt(simpleRangeMatch[1]);
    const startMin = simpleRangeMatch[2];
    let endHour = parseInt(simpleRangeMatch[3]);
    const endMin = simpleRangeMatch[4];
    
    // Assume AM for early hours
    if (startHour < 8) startHour += 12;
    if (endHour < 8 || endHour < startHour) endHour += 12;
    
    const start = `${startHour.toString().padStart(2, '0')}:${startMin}`;
    const end = `${endHour.toString().padStart(2, '0')}:${endMin}`;
    const duration = calculateDuration(start, end);
    
    return { start, end, duration };
  }
  
  return null;
}

/**
 * Calculate duration in minutes between two HH:MM times
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes - startMinutes;
}

/**
 * Extract day from various formats
 * "Fri 1:10" → "Friday"
 */
export function extractDay(text: string): string | null {
  const dayMap: Record<string, string> = {
    'mon': 'Monday',
    'tue': 'Tuesday',
    'wed': 'Wednesday',
    'thu': 'Thursday',
    'fri': 'Friday',
    'sat': 'Saturday',
    'sun': 'Sunday'
  };
  
  for (const [abbr, full] of Object.entries(dayMap)) {
    if (text.toLowerCase().includes(abbr)) {
      return full;
    }
  }
  
  return null;
}

/**
 * Clean and normalize text from PDF
 */
export function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'");
}

/**
 * Fuzzy match division names
 */
export function matchDivision(text: string): Division | null {
  const normalized = text.toLowerCase().trim();
  
  for (const division of VALID_DIVISIONS) {
    if (normalized.includes(division.toLowerCase())) {
      return division;
    }
  }
  
  // Handle common variations
  if (normalized.includes('pre-teen') || normalized.includes('preteen')) return 'PreTeen';
  if (normalized.includes('jr') || normalized.includes('junior')) return 'Junior';
  if (normalized.includes('sr') || normalized.includes('senior')) return 'Senior';
  if (normalized.includes('inter')) return 'Intermediate';
  
  return null;
}

/**
 * Fuzzy match style names
 */
export function matchStyle(text: string): Style | null {
  const normalized = text.toLowerCase().trim();
  
  for (const style of VALID_STYLES) {
    if (normalized.includes(style.toLowerCase())) {
      return style;
    }
  }
  
  // Handle common variations
  if (normalized.includes('contemp')) return 'Contemporary';
  if (normalized.includes('lyric')) return 'Lyrical';
  if (normalized.includes('hiphop') || normalized.includes('hip-hop')) return 'Hip Hop';
  if (normalized.includes('musical') || normalized.includes('theater')) return 'Musical Theater';
  
  return null;
}

/**
 * Fuzzy match group size
 */
export function matchGroupSize(text: string): GroupSize | null {
  const normalized = text.toLowerCase().trim();
  
  for (const size of VALID_GROUP_SIZES) {
    if (normalized.includes(size.toLowerCase())) {
      return size;
    }
  }
  
  // Handle common variations
  if (normalized.includes('duo') || normalized.includes('trio') || normalized.includes('duet')) return 'Duo/Trio';
  if (normalized.includes('small')) return 'Small Group';
  if (normalized.includes('large')) return 'Large Group';
  if (normalized.includes('prod')) return 'Production';
  
  return null;
}

/**
 * Extract instructor name from class text
 * "BALLET - INSTRUCTOR NAME" → "INSTRUCTOR NAME"
 * "Class (Instructor)" → "Instructor"
 */
export function extractInstructor(text: string): string | null {
  // Pattern: "CLASS - INSTRUCTOR"
  const dashMatch = text.match(/[-–]\s*([A-Z\s.]+)$/i);
  if (dashMatch) {
    return cleanText(dashMatch[1]);
  }
  
  // Pattern: "CLASS (INSTRUCTOR)"
  const parenMatch = text.match(/\(([^)]+)\)/);
  if (parenMatch) {
    return cleanText(parenMatch[1]);
  }
  
  return null;
}

/**
 * Parse age range from division text
 * "Mini (5-7)" → "5-7"
 */
export function extractAgeRange(text: string): string | null {
  const ageMatch = text.match(/\((\d+)-(\d+)\)/);
  if (ageMatch) {
    return `${ageMatch[1]}-${ageMatch[2]}`;
  }
  
  // Known age mappings
  const ageMap: Record<string, string> = {
    'spark': '5-7',
    'mini': '8-10',
    'junior': '11-12',
    'intermediate': '13-15',
    'teen': '13-15',
    'senior': '16+'
  };
  
  const normalized = text.toLowerCase();
  for (const [key, range] of Object.entries(ageMap)) {
    if (normalized.includes(key)) {
      return range;
    }
  }
  
  return null;
}
