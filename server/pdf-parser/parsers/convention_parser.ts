/**
 * Convention Schedule Parser (convention_parser)
 * Company-agnostic: works with any dance convention class schedule PDF.
 *
 * Key insight: Each column cell follows the pattern "ClassName | Instructor"
 * Pipes separate class names from instructors, and each pipe marks a new cell.
 */
import type {
  ParserStrategy,
  ParsedRunSlot,
  ParsedConventionClass,
  CompanyType,
} from '../types';
import {
  cleanText,
  matchStyle,
  extractAgeRange,
} from '../utils';

// ─── noise lines to skip ──────────────────────────────────────────────────────

const NOISE_PATTERNS: RegExp[] = [
  /^Page\s+\d+/i,
  /^Dressing\s+Rooms?\s+Open/i,
  /^Studio\s+Icon/i,
  /^—.*—$/,
  /^\s*—\s*(break|lunch|wake\s*up|class\s*break|dressing|competition|weekend)/i,
];

function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some(p => p.test(line));
}

// ─── the parser ───────────────────────────────────────────────────────────────

export class ConventionParser implements ParserStrategy {
  company: CompanyType = 'unknown';

  canParse(_text: string): boolean {
    return true;
  }

  parseRunSheet(_text: string): ParsedRunSlot[] {
    return [];
  }

  // ==========================================================================
  //  CONVENTION CLASSES
  // ==========================================================================

  parseConvention(text: string): ParsedConventionClass[] {
    const classes: ParsedConventionClass[] = [];
    const lines = text.split('\n');

    let currentDay = 'Saturday';
    const columnDivisions: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (isNoiseLine(line)) continue;

      // ── day header ──
      const dayMatch = line.match(
        /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(Class\s+)?Schedule/i,
      );
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }

      if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(line)) {
        currentDay = line;
        continue;
      }

      // ── column header: division row ──
      if (this.isDivisionHeaderLine(line)) {
        columnDivisions.length = 0;
        const cols = this.splitDivisionHeader(line);
        for (const col of cols) columnDivisions.push(col);
        continue;
      }

      // ── time-range detection ──
      const timeRangeMatch = line.match(
        /^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*(AM|PM)?\s*(.*)/i,
      );
      if (!timeRangeMatch) continue;

      const startTime = timeRangeMatch[1];
      const endTime = timeRangeMatch[2];
      const explicitAmPm = timeRangeMatch[3]?.toUpperCase() || null;
      const inlineRemainder = (timeRangeMatch[4] || '').trim();

      // Skip short break ranges (< 15 min)
      const duration = this.calcMinutes(startTime, endTime);
      if (duration < 15) continue;

      // ── gather class content ──
      let classContent = '';

      if (inlineRemainder.length > 5) {
        classContent = inlineRemainder;
      } else {
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (
          !nextLine ||
          isNoiseLine(nextLine) ||
          /^\d{1,2}:\d{2}\s*[-–]/.test(nextLine)
        ) {
          continue;
        }
        classContent = nextLine;
        i++;

        // Consume continuation lines
        while (i + 1 < lines.length) {
          const cont = lines[i + 1].trim();
          if (
            !cont ||
            /^\d{1,2}:\d{2}\s*[-–]/.test(cont) ||
            this.isDivisionHeaderLine(cont) ||
            isNoiseLine(cont) ||
            /(Saturday|Sunday|Friday|Monday|Tuesday|Wednesday|Thursday)\s+(Class\s+)?Schedule/i.test(cont)
          ) {
            break;
          }
          classContent += ' ' + cont;
          i++;
        }
      }

      // ── split content into column cells ──
      const cells = this.splitIntoCells(classContent);

      // ── parse and emit each cell ──
      const startAmPm = explicitAmPm || this.inferAMPM(startTime);
      const endAmPm = explicitAmPm || this.inferAMPM(endTime);
      const start24 = this.to24Hour(startTime, startAmPm);
      const end24 = this.to24Hour(endTime, endAmPm);

      for (let colIdx = 0; colIdx < cells.length; colIdx++) {
        const cellText = cells[colIdx];
        if (!cellText || /^[-—]+$/.test(cellText)) continue;

        const classInfo = this.parseClassCell(cellText);
        if (!classInfo) continue;

        const divLabel = columnDivisions[colIdx] || `Column ${colIdx + 1}`;

        classes.push({
          className: classInfo.className,
          instructor: classInfo.instructor,
          room: divLabel,
          day: currentDay,
          startTime: start24,
          endTime: end24,
          duration: duration > 0 ? duration : undefined,
          style: classInfo.style,
          division: divLabel,
          ageRange: extractAgeRange(divLabel) || undefined,
          level: 'All Levels',
          rawText: cellText,
        });
      }
    }

    return classes;
  }

  // ==========================================================================
  //  CELL SPLITTING - SIMPLIFIED APPROACH
  // ==========================================================================

  /**
   * Split flattened table text into individual column cells.
   * Each cell follows pattern: "ClassName | Instructor"
   * 
   * Example: "Ballet | Tiffany Billings Industry Jazz | Scott Myrick Contemporary | Will Johnston"
   * Should become: ["Ballet | Tiffany Billings", "Industry Jazz | Scott Myrick", "Contemporary | Will Johnston"]
   */
  private splitIntoCells(text: string): string[] {
    // First try: if there are 3+ space gaps, use those as column delimiters
    const wideGapCells = text.split(/\s{3,}/).map(c => c.trim()).filter(c => c.length > 0);
    if (wideGapCells.length > 1) {
      return wideGapCells;
    }

    // Split by pipe character.
    // Input: "Ballet | Tiffany Billings Industry Jazz | Scott Myrick Contemporary | Will Johnston"
    // Pipe-split: ["Ballet ", " Tiffany Billings Industry Jazz ", " Scott Myrick Contemporary ", " Will Johnston"]
    //
    // Pattern: segments[0] = first className
    //          segments[1..n-1] = "instructorName nextClassName" (needs keyword split)
    //          segments[n] = last instructor (no next class after it)
    //
    // Each middle segment contains the instructor for the PREVIOUS cell,
    // followed by the class name for the NEXT cell.

    const segments = text.split('|').map(s => s.trim());

    if (segments.length <= 1) {
      return [text.trim()];
    }

    if (segments.length === 2) {
      // Single cell: "ClassName | Instructor"
      return [text.trim()];
    }

    // Multiple pipes: rebuild cells.
    // segments[0] = first class name
    // segments[1] = instructor1 + className2
    // segments[2] = instructor2 + className3
    // ...
    // segments[n-1] = last instructor (possibly with trailing junk)

    const cells: string[] = [];
    let currentClassName = segments[0];

    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];

      if (i === segments.length - 1) {
        // Last segment: just the instructor for the current cell
        cells.push(`${currentClassName} | ${seg}`);
      } else {
        // Middle segment: "InstructorName NextClassName"
        // Use keyword detection to find boundary
        const instructorName = this.extractInstructorName(seg);
        const remainder = this.findNextClassName(seg, instructorName);

        if (remainder.length > 0) {
          cells.push(`${currentClassName} | ${instructorName}`);
          currentClassName = remainder;
        } else {
          // Couldn't split — treat entire segment as instructor
          cells.push(`${currentClassName} | ${seg}`);
          // Next segment's className will come from the following iteration
          currentClassName = '';
        }
      }
    }

    return cells.filter(cell => cell.trim().length > 0);
  }

  /**
   * Extract just the instructor name from a string that might contain the next class name
   */
  private extractInstructorName(text: string): string {
    const words = text.split(/\s+/);
    
    // Common dance style keywords that might indicate start of next class
    const styleKeywords = [
      'ballet', 'jazz', 'tap', 'contemporary', 'lyrical', 'hip-hop', 'hip hop',
      'modern', 'acro', 'musical', 'audition', 'industry', 'advanced',
      'battle', 'unscripted', 'get', 'teacher', 'warm-up', 'warm up',
      'stretch', 'technique', 'improvisation', 'choreography'
    ];
    
    // Look for where a style keyword appears (case insensitive)
    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();
      if (styleKeywords.includes(word) || 
          (i < words.length - 1 && styleKeywords.includes(word + ' ' + words[i + 1].toLowerCase()))) {
        // Found start of next class name, return everything before this
        return words.slice(0, i).join(' ');
      }
    }
    
    // If no style keyword found, assume last 2 words are instructor name
    // (most instructors are First Last)
    if (words.length > 2) {
      // Check if last word is capitalized (likely a last name)
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.length > 0 && lastWord[0] === lastWord[0].toUpperCase()) {
        // Return last 2 words as instructor name
        return words.slice(-2).join(' ');
      }
    }
    
    return text; // Return as-is if can't determine
  }

  /**
   * Find if there's a next class name in the instructor string
   * Returns the class name if found, empty string otherwise
   */
  private findNextClassName(instructorText: string, extractedInstructor: string): string {
    if (extractedInstructor === instructorText) {
      return '';
    }
    
    // Find where the extracted instructor ends in the original text
    const instructorIndex = instructorText.indexOf(extractedInstructor);
    if (instructorIndex === -1) {
      return '';
    }
    
    // Get the remaining text after the instructor
    const remaining = instructorText.substring(instructorIndex + extractedInstructor.length).trim();
    return remaining;
  }

  // ==========================================================================
  //  DIVISION HEADER PARSING
  // ==========================================================================

  private splitDivisionHeader(line: string): string[] {
    // Try splitting by wide whitespace first
    const wideSplit = line.split(/\s{3,}/).map(c => c.trim()).filter(c => c.length > 0);
    if (wideSplit.length > 1) {
      return wideSplit;
    }

    // Split by single spaces and recombine into division groups.
    // Compound labels like "TEEN/SENIOR" must stay together.
    const tokens = line.split(/\s+/).filter(t => t.length > 0);
    const divKeywordsSet = new Set([
      'mini','spark','junior','teen','teen/senior','senior','preteen',
      'pre-teen','petite','rising','star','novice','elite','all','ages',
      'intermediate','breakout','open',
    ]);

    // First pass: identify which tokens start a new division label.
    // A token starts a new group if it (lowercased) is a known keyword
    // AND the previous token also completed a keyword group.
    const groups: string[][] = [];
    let current: string[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      // Does this token start a new division keyword?
      const isKw =
        divKeywordsSet.has(lower) ||
        divKeywordsSet.has(lower.replace(/\/.*/, '')); // "teen/senior" → "teen"

      if (isKw && current.length > 0) {
        // Check if this token extends the current group
        // e.g. "TEEN" then "/SENIOR" or "RISING" then "STAR" or "ALL" then "AGES"
        const prevLower = current[current.length - 1].toLowerCase();
        if (
          (prevLower === 'teen' && lower.startsWith('senior')) ||
          (prevLower === 'rising' && lower === 'star') ||
          (prevLower === 'all' && lower === 'ages')
        ) {
          // Merge with current group
          current.push(token);
          continue;
        }
        // Otherwise start a new group
        groups.push(current);
        current = [token];
      } else {
        current.push(token);
      }
    }
    if (current.length > 0) groups.push(current);

    const result = groups.map(g => g.join(' ')).filter(s => s.length > 0);
    return result.length > 0 ? result : [line];
  }

  private isDivisionHeaderLine(line: string): boolean {
    // Must have 2+ division keywords AND not be a noise/event line
    if (/wake\s*up|wrap.*up|faculty|performance|scholarship|dressing|competition/i.test(line)) {
      return false;
    }
    const divKeywords = [
      'mini', 'spark', 'junior', 'teen', 'senior', 'preteen',
      'pre-teen', 'intermediate', 'breakout', 'all ages',
      'petite', 'rising star', 'novice', 'elite',
    ];
    const lower = line.toLowerCase();
    let matchCount = 0;
    for (const kw of divKeywords) {
      if (lower.includes(kw)) matchCount++;
    }
    return matchCount >= 2;
  }

  // ==========================================================================
  //  HELPERS
  // ==========================================================================

  private calcMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin < startMin) endMin += 12 * 60;
    return endMin - startMin;
  }

  private inferAMPM(time: string): string {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour >= 7 && hour < 12) return 'AM';
    if (hour === 12) return 'PM';
    if (hour >= 1 && hour <= 6) return 'PM';
    return 'AM';
  }

  private to24Hour(time: string, ampm: string): string {
    const [h, m] = time.split(':').map(Number);
    let hour24 = h;
    if (ampm === 'PM' && hour24 < 12) hour24 += 12;
    if (ampm === 'AM' && hour24 === 12) hour24 = 0;
    return `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * Parse "ClassName | Instructor" into parts.
   */
  private parseClassCell(
    cellText: string,
  ): {
    className: string;
    instructor: string;
    style: string | undefined;
  } | null {
    if (!cellText || cellText === '—' || cellText === '-') return null;

    // Try pipe separator first
    const pipeParts = cellText.split('|').map(p => p.trim());
    if (pipeParts.length >= 2) {
      const className = pipeParts[0];
      const instructor = pipeParts.slice(1).join(' ').trim() || 'TBD';
      const style = matchStyle(className) || undefined;
      
      return {
        className: cleanText(className),
        instructor: cleanText(instructor),
        style,
      };
    }

    // Try other separators
    let parts = cellText.split(/\bwith\b|\bw\//i).map(p => p.trim());
    if (parts.length < 2) {
      parts = cellText.split(/\s[-–]\s/).map(p => p.trim());
    }

    if (parts.length < 2) {
      const style = matchStyle(cellText) || undefined;
      return { className: cleanText(cellText), instructor: 'TBD', style };
    }

    const className = parts[0];
    const instructor = parts.slice(1).join(' ').trim() || 'TBD';
    const style = matchStyle(className) || undefined;

    return {
      className: cleanText(className),
      instructor: cleanText(instructor),
      style,
    };
  }
}