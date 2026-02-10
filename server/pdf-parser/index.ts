/**
 * Main PDF Parser
 * Orchestrates PDF parsing by detecting format and routing to appropriate parser
 */

import { PDFParse } from 'pdf-parse';
import type { ParseResult, ParserStrategy, ParsedRunSlot, ParsedConventionClass, CompanyType } from './types';
import { CompParser } from './parsers/comp_parser';
import { ConventionParser } from './parsers/convention_parser';

export class PDFParser {
  private parsers: ParserStrategy[];

  constructor() {
    this.parsers = [
      new CompParser(),          // Competition parser
      new ConventionParser()     // Convention parser
    ];
  }

  async parsePDF(
    buffer: Buffer,
    fileName: string,
    expectedType?: 'runsheet' | 'convention'
  ): Promise<ParseResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const pdf = new PDFParse(new Uint8Array(buffer));
      const textResult = await pdf.getText();
      const infoResult = await pdf.getInfo();
      const text = textResult.text;
      const pageCount = infoResult.total;

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          type: expectedType || 'runsheet',
          company: 'unknown',
          data: [],
          errors: ['PDF contains no extractable text'],
          warnings: [],
          metadata: { parsedAt: new Date(), fileName, pageCount, totalEntries: 0 }
        };
      }

      const isConvention = this.detectConventionFormat(text);
      const type: 'runsheet' | 'convention' = expectedType || (isConvention ? 'convention' : 'runsheet');

      let parsedData: ParsedRunSlot[] | ParsedConventionClass[] = [];
      let matchedCompany: CompanyType = 'unknown';

      // Try each parser in order and keep the first non-empty result.
      for (const parser of this.parsers) {
        if (!parser.canParse(text)) continue;

        try {
          if (type === 'convention') {
            parsedData = parser.parseConvention(text);
          } else {
            parsedData = parser.parseRunSheet(text);
          }
        } catch (error: any) {
          errors.push(`Parse error (${parser.company}): ${error.message}`);
          parsedData = [];
        }

        if (parsedData.length > 0) {
          matchedCompany = parser.company;
          break;
        }
      }

      if (parsedData.length === 0) {
        warnings.push('No entries were extracted from the PDF');
      }

      const incompleteCount = parsedData.filter(entry => {
        if ('routineName' in entry) {
          return !entry.division || !entry.style || !entry.groupSize;
        } else {
          return !entry.className || !entry.instructor;
        }
      }).length;

      if (incompleteCount > 0) {
        warnings.push(`${incompleteCount} entries are missing required fields`);
      }

      return {
        success: parsedData.length > 0,
        type,
        company: matchedCompany,
        data: parsedData,
        errors,
        warnings,
        metadata: { parsedAt: new Date(), fileName, pageCount, totalEntries: parsedData.length }
      };

    } catch (error: any) {
      return {
        success: false,
        type: expectedType || 'runsheet',
        company: 'unknown',
        data: [],
        errors: [`Failed to parse PDF: ${error.message}`],
        warnings: [],
        metadata: { parsedAt: new Date(), fileName, pageCount: 0, totalEntries: 0 }
      };
    }
  }

  private detectConventionFormat(text: string): boolean {
    const normalized = text.toLowerCase();

    // "class schedule" is the strongest convention signal — weight it heavily
    const conventionIndicators: [string, number][] = [
      ['class schedule', 3],
      ['convention', 2],
      ['instructor', 1],
      ['room', 1],
      ['studio a', 1],
      ['studio b', 1],
      ['audition phrase', 1],
      ['breakout', 1],
    ];

    // Run-sheet signals — "competition" in context of "competition starts"
    // is NOT the same as a competition run sheet header
    const runSheetIndicators: [string, number][] = [
      ['entry #', 3],
      ['entry number', 3],
      ['placement', 2],
      ['entry', 1],
      ['awards', 1],
    ];

    // "competition starts" is a convention-schedule phrase, not a runsheet signal
    const hasCompetitionStarts = /competition\s+starts/i.test(text);

    let conventionScore = 0;
    let runSheetScore = 0;

    for (const [indicator, weight] of conventionIndicators) {
      if (normalized.includes(indicator)) conventionScore += weight;
    }

    for (const [indicator, weight] of runSheetIndicators) {
      if (indicator === 'entry' && normalized.includes(indicator)) {
        // Only count bare "entry" if it appears as a column header pattern
        if (/entry\s*#|entry\s+number/i.test(text)) {
          runSheetScore += weight;
        }
      } else if (normalized.includes(indicator)) {
        // Skip "competition" if it's "competition starts"
        if (indicator === 'competition' && hasCompetitionStarts) continue;
        runSheetScore += weight;
      }
    }

    return conventionScore >= runSheetScore;
  }
}
