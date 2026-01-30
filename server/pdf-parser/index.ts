/**
 * Main PDF Parser
 * Orchestrates PDF parsing by detecting format and routing to appropriate parser
 */

import { PDFParse } from 'pdf-parse';
import type { ParseResult, ParserStrategy, ParsedRunSlot, ParsedConventionClass } from './types';
import { VelocityParser } from './parsers/velocity';
import { WCDEParser } from './parsers/wcde';

export class PDFParser {
  private parsers: ParserStrategy[];

  constructor() {
    this.parsers = [
      new VelocityParser(),
      new WCDEParser()
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
      const pdfParseInstance = new PDFParse(new Uint8Array(buffer));
      const textResult = await pdfParseInstance.getText();
      const infoResult = await pdfParseInstance.getInfo();
      const text = textResult.text;
      const pageCount = infoResult.total || 1;

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

      const parser = this.detectParser(text);

      if (!parser) {
        return {
          success: false,
          type: expectedType || 'runsheet',
          company: 'unknown',
          data: [],
          errors: ['Unable to detect PDF format. Supported formats: Velocity, WCDE'],
          warnings: [],
          metadata: { parsedAt: new Date(), fileName, pageCount, totalEntries: 0 }
        };
      }

      const isConvention = this.detectConventionFormat(text);
      const type: 'runsheet' | 'convention' = expectedType || (isConvention ? 'convention' : 'runsheet');

      let data: ParsedRunSlot[] | ParsedConventionClass[];

      try {
        if (type === 'convention') {
          data = parser.parseConvention(text);
        } else {
          data = parser.parseRunSheet(text);
        }
      } catch (error: any) {
        errors.push(`Parse error: ${error.message}`);
        data = [];
      }

      if (data.length === 0) {
        warnings.push('No entries were extracted from the PDF');
      }

      const incompleteCount = data.filter(entry => {
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
        success: data.length > 0,
        type,
        company: parser.company,
        data,
        errors,
        warnings,
        metadata: { parsedAt: new Date(), fileName, pageCount, totalEntries: data.length }
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

  private detectParser(text: string): ParserStrategy | null {
    for (const parser of this.parsers) {
      if (parser.canParse(text)) {
        return parser;
      }
    }
    return null;
  }

  private detectConventionFormat(text: string): boolean {
    const normalized = text.toLowerCase();

    const conventionIndicators = [
      'convention', 'class schedule', 'instructor', 'room',
      'studio a', 'studio b', 'audition phrase'
    ];

    const runSheetIndicators = [
      'entry', 'entry #', 'competition', 'awards', 'placement'
    ];

    let conventionScore = 0;
    let runSheetScore = 0;

    for (const indicator of conventionIndicators) {
      if (normalized.includes(indicator)) conventionScore++;
    }

    for (const indicator of runSheetIndicators) {
      if (normalized.includes(indicator)) runSheetScore++;
    }

    return conventionScore > runSheetScore;
  }
}
