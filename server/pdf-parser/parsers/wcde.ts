/**
 * WCDE (West Coast Dance Explosion) Parser
 * Handles convention schedules with grid format:
 * - Columns: MINI | JUNIOR | TEEN/SENIOR | BREAKOUT
 * - Format: "7:45-8:45, Ballet | Tiffany Billings"
 */

import type { ParserStrategy, ParsedRunSlot, ParsedConventionClass } from '../types';
import {
  parseTimeRange,
  cleanText,
  matchStyle,
  extractInstructor
} from '../utils';

export class WCDEParser implements ParserStrategy {
  company = 'wcde' as const;

  canParse(text: string): boolean {
    const normalized = text.toLowerCase();
    return normalized.includes('wcde') ||
           normalized.includes('west coast dance') ||
           (normalized.includes('mini') && normalized.includes('junior') && normalized.includes('breakout')) ||
           (normalized.includes('competition list') && normalized.includes('baltimore'));
  }

  parseRunSheet(text: string): ParsedRunSlot[] {
    const runSlots: ParsedRunSlot[] = [];
    const lines = text.split('\n');

    let currentDay = 'Friday';
    let currentTimeBlock = '';
    let currentDivision = '';
    let currentGroupSize = '';
    let entryNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check for day headers
      const dayMatch = line.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{1,2},\s*\d{4}/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }

      // Check for time blocks (e.g., "SOLOBLAST COMPETITION: MINI AGE DIVISION - 11:00 AM - 12:10 PM")
      const timeBlockMatch = line.match(/([\d:]+)\s*[ap]m\s*-\s*([\d:]+)\s*[ap]m/i);
      if (timeBlockMatch) {
        currentTimeBlock = `${timeBlockMatch[1]} ${timeBlockMatch[1].includes('AM') ? 'AM' : 'PM'} - ${timeBlockMatch[2]} ${timeBlockMatch[2].includes('AM') ? 'AM' : 'PM'}`;
        continue;
      }

      // Check for division headers (e.g., "SOLOBLAST COMPETITION: MINI AGE DIVISION")
      const divisionMatch = line.match(/(SOLOBLAST|DUET|TRIO|GROUP|LINE|PRODUCTION).*?(MINI|JUNIOR|TEEN|SENIOR)/i);
      if (divisionMatch) {
        currentDivision = divisionMatch[2];
        continue;
      }

      // Check for group size headers
      const groupSizeMatch = line.match(/Group Size:\s*(Solo|Duet|Trio|Small Group|Large Group|Line|Production)/i);
      if (groupSizeMatch) {
        currentGroupSize = groupSizeMatch[1];
        continue;
      }

      // Parse entry lines (e.g., "1 Real Wild Child Mini Solo  Jazz 11:00      B-viBe The Dance")
      // Handle multi-line entries where routine name spans multiple lines
      const entryMatch = line.match(/^(\d+)\s+(.+?)\s+(\w+)\s+(\w+)\s+(\d{1,2}:\d{2})\s+(.+)$/);
      if (entryMatch) {
        entryNumber = parseInt(entryMatch[1]);

        let routineName = cleanText(entryMatch[2]);
        let division = cleanText(entryMatch[3]);
        let style = cleanText(entryMatch[4]);
        let time = cleanText(entryMatch[5]);
        let studioName = cleanText(entryMatch[6]);

        // Check if this entry continues on the next line (multi-line routine name)
        if (i < lines.length - 1 && !lines[i+1].trim().match(/^\d+/) && lines[i+1].trim().length > 0 &&
            !lines[i+1].match(/\d{1,2}:\d{2}/)) {
          // Combine with next line
          routineName += ' ' + cleanText(lines[i+1].trim());
          // Skip the next line since we've already processed it
          i++;
        }

        // Parse time to 24-hour format
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours);
        const ampm = line.includes('AM') ? 'AM' : 'PM';

        if (ampm === 'PM' && hour24 < 12) hour24 += 12;
        if (ampm === 'AM' && hour24 === 12) hour24 = 0;

        const performanceTime = `${hour24.toString().padStart(2, '0')}:${minutes}`;

        // Determine group size based on division and context
        let groupSize = 'Solo';
        if (division.includes('Duet')) groupSize = 'Duet';
        else if (division.includes('Trio')) groupSize = 'Trio';
        else if (division.includes('Group')) groupSize = 'Small Group';
        else if (division.includes('Line')) groupSize = 'Line';
        else if (division.includes('Production')) groupSize = 'Production';

        runSlots.push({
          entryNumber: entryNumber.toString(),
          routineName,
          division,
          style,
          groupSize,
          studioName,
          day: currentDay,
          performanceTime,
          stage: 'Main Stage',
          orderNumber: entryNumber,
          rawText: line
        });
      }
    }

    return runSlots;
  }

  parseConvention(text: string): ParsedConventionClass[] {
    const classes: ParsedConventionClass[] = [];
    const lines = text.split('\n');
    
    const columnDivisions = ['Mini', 'Junior', 'Teen', 'Senior'];
    const columnAgeRanges = ['8-10', '11-12', '13-15', '16+'];
    
    let currentDay = 'Friday';
    let roomHeaders: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const dayMatch = line.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }
      
      if (/MINI|JUNIOR|TEEN|SENIOR|BREAKOUT/i.test(line)) {
        const parts = line.split(/[|\t]/).map(p => cleanText(p));
        roomHeaders = parts;
        continue;
      }
      
      const timeMatch = line.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
      if (timeMatch) {
        const timeRange = parseTimeRange(timeMatch[0]);
        if (!timeRange) continue;
        
        const cells = line.split(/[|\t]/).map(p => cleanText(p));
        
        for (let cellIdx = 1; cellIdx < cells.length; cellIdx++) {
          const cellText = cells[cellIdx];
          if (!cellText || cellText.length < 3) continue;
          
          if (/^BREAKOUT$/i.test(cellText)) continue;
          
          const parts = cellText.split(/[,|]/).map(p => cleanText(p));
          
          let className = parts[0];
          let instructor = parts[1] || extractInstructor(cellText) || 'TBD';
          
          if (className && instructor) {
            const style = matchStyle(className);
            const division = columnDivisions[cellIdx - 1] || 'Teen';
            const ageRange = columnAgeRanges[cellIdx - 1] || '13+';
            const roomName = roomHeaders[cellIdx] || `Studio ${division}`;
            
            classes.push({
              className: cleanText(className),
              instructor: cleanText(instructor),
              room: roomName,
              day: currentDay,
              startTime: timeRange.start,
              endTime: timeRange.end,
              duration: timeRange.duration,
              style: style || undefined,
              division,
              ageRange,
              level: 'All Levels',
              rawText: cellText
            });
          }
        }
      }
    }
    
    return classes;
  }
}
