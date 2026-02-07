/**
 * Simple PDF Text Extractor
 * Extracts raw text from PDFs and attempts basic pattern matching
 * No complex parsing - just best-effort extraction for user verification
 */

import { PDFParse } from 'pdf-parse';

export interface ExtractedRunSheetEntry {
  entryNumber?: string;
  routineName: string;
  division: string;
  style: string;
  groupSize: string;
  studioName: string;
  performanceTime: string;
  day?: string;
  rawLine: string;
}

export interface ExtractionResult {
  success: boolean;
  entries: ExtractedRunSheetEntry[];
  rawText: string;
  errors: string[];
  warnings: string[];
}

export class PDFExtractor {
  /**
   * Extract text from PDF and attempt to parse run sheet entries
   */
  async extractRunSheet(buffer: Buffer): Promise<ExtractionResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: ExtractedRunSheetEntry[] = [];

    try {
      // Extract raw text from PDF
      const parser = new PDFParse(buffer);
      const textResult = await parser.getText();
      const rawText = textResult.text;

      if (!rawText || rawText.trim().length === 0) {
        return {
          success: false,
          entries: [],
          rawText: '',
          errors: ['PDF contains no extractable text'],
          warnings: []
        };
      }

      // Split into lines
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      let currentDay: string | undefined;

      for (const line of lines) {
        // Detect day headers
        const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
        if (dayMatch) {
          currentDay = dayMatch[1];
          continue;
        }

        // Skip header lines and breaks
        if (
          /^(time|entry|#|awards|break|lunch)/i.test(line) ||
          line.length < 15
        ) {
          continue;
        }

        // Attempt to extract entry data using flexible pattern matching
        const extracted = this.extractEntryFromLine(line);
        
        if (extracted) {
          entries.push({
            ...extracted,
            day: currentDay,
            rawLine: line
          });
        }
      }

      if (entries.length === 0) {
        warnings.push('No entries could be extracted. You may need to enter data manually.');
      }

      return {
        success: entries.length > 0,
        entries,
        rawText,
        errors,
        warnings
      };

    } catch (error: any) {
      return {
        success: false,
        entries: [],
        rawText: '',
        errors: [`Failed to extract PDF: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Attempt to extract entry data from a single line
   * Uses flexible pattern matching - not perfect, but good enough for user verification
   */
  private extractEntryFromLine(line: string): Omit<ExtractedRunSheetEntry, 'day' | 'rawLine'> | null {
    // Common patterns:
    // "1 Real Wild Child Mini Jazz Solo B-viBe The Dance 11:00"
    // "42 Routine Name Junior Contemporary Duo/Trio Studio Name 1:30"
    
    // Try to match: [number] [routine name] [division] [style] [group size] [studio] [time]
    const pattern = /^(\d+)\s+(.+?)\s+(Mini|Spark|Junior|Teen|Senior|Intermediate|PreTeen)\s+(\w+)\s+(Solo|Duo\/Trio|Duet|Trio|Small Group|Large Group|Line|Production)\s+(.+?)\s+(\d{1,2}:\d{2})$/i;
    
    const match = line.match(pattern);
    
    if (match) {
      return {
        entryNumber: match[1],
        routineName: this.cleanText(match[2]),
        division: this.normalizeDivision(match[3]),
        style: this.normalizeStyle(match[4]),
        groupSize: this.normalizeGroupSize(match[5]),
        studioName: this.cleanText(match[6]),
        performanceTime: this.normalizeTime(match[7])
      };
    }

    // Try without entry number
    const patternNoEntry = /^(.+?)\s+(Mini|Spark|Junior|Teen|Senior|Intermediate|PreTeen)\s+(\w+)\s+(Solo|Duo\/Trio|Duet|Trio|Small Group|Large Group|Line|Production)\s+(.+?)\s+(\d{1,2}:\d{2})$/i;
    
    const matchNoEntry = line.match(patternNoEntry);
    
    if (matchNoEntry) {
      return {
        routineName: this.cleanText(matchNoEntry[1]),
        division: this.normalizeDivision(matchNoEntry[2]),
        style: this.normalizeStyle(matchNoEntry[3]),
        groupSize: this.normalizeGroupSize(matchNoEntry[4]),
        studioName: this.cleanText(matchNoEntry[5]),
        performanceTime: this.normalizeTime(matchNoEntry[6])
      };
    }

    // If no pattern matches, return null (user will need to add manually)
    return null;
  }

  /**
   * Clean text - remove extra whitespace
   */
  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Normalize division names
   */
  private normalizeDivision(division: string): string {
    const lower = division.toLowerCase();
    if (lower.includes('mini')) return 'Mini';
    if (lower.includes('spark')) return 'Spark';
    if (lower.includes('preteen') || lower.includes('pre-teen')) return 'PreTeen';
    if (lower.includes('junior') || lower === 'jr') return 'Junior';
    if (lower.includes('intermediate') || lower === 'inter') return 'Intermediate';
    if (lower.includes('teen')) return 'Teen';
    if (lower.includes('senior') || lower === 'sr') return 'Senior';
    return division;
  }

  /**
   * Normalize style names
   */
  private normalizeStyle(style: string): string {
    const lower = style.toLowerCase();
    if (lower === 'contemp') return 'Contemporary';
    if (lower === 'mus' || lower === 'musical') return 'Musical Theatre';
    if (lower === 'hiphop' || lower === 'hip-hop') return 'Hip Hop';
    if (lower === 'lyric') return 'Lyrical';
    return style;
  }

  /**
   * Normalize group size
   */
  private normalizeGroupSize(size: string): string {
    const lower = size.toLowerCase();
    if (lower.includes('duo') || lower.includes('trio') || lower.includes('duet')) return 'Duo/Trio';
    if (lower.includes('small')) return 'Small Group';
    if (lower.includes('large')) return 'Large Group';
    if (lower.includes('prod')) return 'Production';
    return size;
  }

  /**
   * Normalize time to 12hr format without AM/PM
   * "11:00" -> "11:00"
   * "1:30" -> "1:30"
   */
  private normalizeTime(time: string): string {
    const match = time.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = parseInt(match[1]);
      const minute = match[2];
      return `${hour}:${minute}`;
    }
    return time;
  }
}
