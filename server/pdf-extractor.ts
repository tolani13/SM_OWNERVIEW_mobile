/**
 * Simple PDF Text Extractor
 * Extracts raw text from PDFs and attempts basic pattern matching
 * No complex parsing - just best-effort extraction for user verification
 */

import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';

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
  methodUsed: 'text' | 'ocr' | 'text+ocr' | 'none';
  confidence: number;
  ocrDiagnostics?: {
    engine: 'rasterized' | 'direct' | 'none';
    pageCount: number;
    averageConfidence: number;
    pages: Array<{
      pageNumber: number;
      confidence: number;
      textLength: number;
    }>;
  };
  errors: string[];
  warnings: string[];
}

export interface ExtractRunSheetOptions {
  mode?: 'auto' | 'text' | 'ocr';
}

export class PDFExtractor {
  /**
   * Extract text from PDF and attempt to parse run sheet entries
   */
  async extractRunSheet(buffer: Buffer, options?: ExtractRunSheetOptions): Promise<ExtractionResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const mode = options?.mode ?? 'auto';

    try {
      const textFromPdf = await this.extractTextFromPdf(buffer);
      const parsedFromText = this.parseEntriesFromRawText(textFromPdf);

      if (mode === 'text') {
        if (parsedFromText.entries.length === 0) {
          warnings.push('Text mode found little/no structured entries. Try mode=ocr for scanned PDFs.');
        }
        return {
          success: true,
          entries: parsedFromText.entries,
          rawText: textFromPdf,
          methodUsed: textFromPdf.trim().length > 0 ? 'text' : 'none',
          confidence: this.estimateConfidence(parsedFromText.entries.length, textFromPdf),
          errors,
          warnings: [...warnings, ...parsedFromText.warnings],
        };
      }

      if (mode === 'ocr') {
        const ocrResult = await this.extractTextWithOCR(buffer, warnings);
        const parsedFromOcr = this.parseEntriesFromRawText(ocrResult.text);
        if (parsedFromOcr.entries.length === 0) {
          warnings.push('OCR mode did not produce structured entries. Manual review/edit likely needed.');
        }
        return {
          success: true,
          entries: parsedFromOcr.entries,
          rawText: ocrResult.text,
          methodUsed: ocrResult.text.trim().length > 0 ? 'ocr' : 'none',
          confidence: this.estimateConfidence(parsedFromOcr.entries.length, ocrResult.text),
          ocrDiagnostics: ocrResult.diagnostics,
          errors,
          warnings: [...warnings, ...parsedFromOcr.warnings],
        };
      }

      // auto mode: text first, OCR fallback when text extraction is weak
      if (parsedFromText.entries.length > 0) {
        return {
          success: true,
          entries: parsedFromText.entries,
          rawText: textFromPdf,
          methodUsed: 'text',
          confidence: this.estimateConfidence(parsedFromText.entries.length, textFromPdf),
          errors,
          warnings: parsedFromText.warnings,
        };
      }

      warnings.push('Text extraction found no structured entries. Attempting OCR fallback...');
      const ocrResult = await this.extractTextWithOCR(buffer, warnings);
      const parsedFromOcr = this.parseEntriesFromRawText(ocrResult.text);

      if (parsedFromOcr.entries.length > 0) {
        return {
          success: true,
          entries: parsedFromOcr.entries,
          rawText: ocrResult.text,
          methodUsed: 'ocr',
          confidence: this.estimateConfidence(parsedFromOcr.entries.length, ocrResult.text),
          ocrDiagnostics: ocrResult.diagnostics,
          errors,
          warnings: [...warnings, ...parsedFromOcr.warnings],
        };
      }

      warnings.push('No entries could be extracted. You may need to enter data manually.');
      return {
        success: true,
        entries: [],
        rawText: textFromPdf || ocrResult.text || '',
        methodUsed: textFromPdf.trim().length > 0 && ocrResult.text.trim().length > 0 ? 'text+ocr' : (textFromPdf.trim().length > 0 ? 'text' : (ocrResult.text.trim().length > 0 ? 'ocr' : 'none')),
        confidence: 0,
        ocrDiagnostics: ocrResult.diagnostics,
        errors,
        warnings,
      };

    } catch (error: any) {
      return {
        success: false,
        entries: [],
        rawText: '',
        methodUsed: 'none',
        confidence: 0,
        errors: [`Failed to extract PDF: ${error.message}`],
        warnings: []
      };
    }
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse(new Uint8Array(buffer));
      const textResult = await parser.getText();
      return textResult.text || '';
    } catch {
      return '';
    }
  }

  private async extractTextWithOCR(
    buffer: Buffer,
    warnings: string[],
  ): Promise<{
    text: string;
    diagnostics: ExtractionResult['ocrDiagnostics'];
  }> {
    // Robust scanned-PDF OCR path: rasterize each PDF page to image, then OCR each page.
    // IMPORTANT: Do not pass raw PDF buffers directly into Tesseract, as Leptonica cannot read PDF streams.
    const rasterizedResult = await this.extractTextWithRasterizedPages(buffer, warnings);
    if (rasterizedResult.text.trim().length > 0) {
      return {
        text: rasterizedResult.text,
        diagnostics: {
          engine: 'rasterized',
          pageCount: rasterizedResult.pages.length,
          averageConfidence: rasterizedResult.averageConfidence,
          pages: rasterizedResult.pages,
        },
      };
    }

    warnings.push('Rasterized OCR returned no text. Skipping direct PDF OCR fallback (unsupported for PDF streams).');
    return {
      text: '',
      diagnostics: {
        engine: 'none',
        pageCount: rasterizedResult.pages.length,
        averageConfidence: rasterizedResult.averageConfidence,
        pages: rasterizedResult.pages,
      },
    };
  }

  private async extractTextWithRasterizedPages(
    buffer: Buffer,
    warnings: string[],
  ): Promise<{
    text: string;
    pages: Array<{ pageNumber: number; confidence: number; textLength: number }>;
    averageConfidence: number;
  }> {
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const canvasLib = await import('@napi-rs/canvas');
      const { createRequire } = await import('module');
      const { pathToFileURL } = await import('url');
      const createCanvas = (canvasLib as any).createCanvas;

      // Force worker/api version alignment by resolving worker from the same installed pdfjs-dist package.
      const require = createRequire(import.meta.url);
      const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

      if (!createCanvas) {
        warnings.push('Canvas runtime unavailable for PDF rasterization.');
        return {
          text: '',
          pages: [],
          averageConfidence: 0,
        };
      }

      const loadingTask = (pdfjsLib as any).getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        useSystemFonts: true,
      });

      const pdf = await loadingTask.promise;
      const pageTexts: string[] = [];
      const pageDiagnostics: Array<{ pageNumber: number; confidence: number; textLength: number }> = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        if (!context) continue;

        await page.render({
          canvasContext: context as any,
          viewport,
        }).promise;

        const imageBuffer: Buffer = canvas.toBuffer('image/png');
        const ocrResult = await Tesseract.recognize(imageBuffer, 'eng');
        const pageText = ocrResult?.data?.text?.trim() || '';
        const pageConfidence = Number(ocrResult?.data?.confidence || 0);

        pageDiagnostics.push({
          pageNumber: pageNum,
          confidence: pageConfidence,
          textLength: pageText.length,
        });

        if (pageText) {
          pageTexts.push(pageText);
        }
      }

      const averageConfidence =
        pageDiagnostics.length > 0
          ? pageDiagnostics.reduce((sum, p) => sum + p.confidence, 0) / pageDiagnostics.length
          : 0;

      return {
        text: pageTexts.join('\n\n'),
        pages: pageDiagnostics,
        averageConfidence,
      };
    } catch (error: any) {
      warnings.push(`Rasterized OCR path failed: ${error?.message || 'unknown error'}`);
      return {
        text: '',
        pages: [],
        averageConfidence: 0,
      };
    }
  }

  private parseEntriesFromRawText(rawText: string): { entries: ExtractedRunSheetEntry[]; warnings: string[] } {
    const warnings: string[] = [];
    const entries: ExtractedRunSheetEntry[] = [];

    if (!rawText || rawText.trim().length === 0) {
      return { entries, warnings: ['No extractable text found in document.'] };
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentDay: string | undefined;

    for (const line of lines) {
      const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }

      if (/^(time|entry|#|awards|break|lunch)/i.test(line) || line.length < 15) {
        continue;
      }

      const extracted = this.extractEntryFromLine(line);
      if (extracted) {
        entries.push({
          ...extracted,
          day: currentDay,
          rawLine: line,
        });
      }
    }

    if (entries.length === 0) {
      warnings.push('No structured rows matched expected run-sheet patterns.');
    }

    return { entries, warnings };
  }

  private estimateConfidence(entryCount: number, rawText: string): number {
    if (!rawText.trim()) return 0;
    if (entryCount <= 0) return 0.15;
    if (entryCount < 5) return 0.45;
    if (entryCount < 20) return 0.7;
    return 0.85;
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
