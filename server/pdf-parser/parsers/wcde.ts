/**
 * WCDE (West Coast Dance Explosion) Parser - PRODUCTION GRADE
 * Parses actual WCDE PDF formats for competition schedules and convention classes
 */

import type { ParserStrategy, ParsedRunSlot, ParsedConventionClass } from '../types';

export class WCDEParser implements ParserStrategy {
  company = 'wcde' as const;

  canParse(text: string): boolean {
    const normalized = text.toLowerCase();
    return (
      normalized.includes('wcde') ||
      normalized.includes('west coast dance') ||
      (normalized.includes('baltimore season') && normalized.includes('competition list')) ||
      (normalized.includes('mini') && normalized.includes('junior') && normalized.includes('breakout'))
    );
  }

  parseRunSheet(text: string): ParsedRunSlot[] {
    const slots: ParsedRunSlot[] = [];
    const lines = text.split('\n').map(l => l.trim());
    
    let currentDay = 'Friday';
    let currentDivision = 'Mini';
    let currentSessionAMPM = 'AM'; // Track AM/PM from session header
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Day header: "Friday - January 30, 2026"
      const dayMatch = line.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*-\s*/);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }
      
      // Session header: "SOLOBLAST COMPETITION: MINI AGE DIVISION - 11:00 AM - 12:10 PM"
      const sessionMatch = line.match(/^(SOLOBLAST|DUO\/TRIO|GROUP).*?:\s*(\w+)\s+AGE.*?-\s*(\d{1,2}:\d{2})\s*([AP]M)/i);
      if (sessionMatch) {
        currentDivision = this.normalizeDivision(sessionMatch[2]);
        currentSessionAMPM = sessionMatch[4];
        continue;
      }
      
      // Entry line format: "1 Real Wild Child Mini Jazz Solo B-viBe The Dance 11:00"
      // Note: Studio name may wrap to next line
      const entryMatch = line.match(/^(\d+)\s+(.+?)\s+(Mini|Junior|Teen|Senior)\s+(\S+)\s+(Solo|Duo\/Trio|Small Group|Large Group|Line|Production)\s+(.+?)\s+(\d{1,2}:\d{2})$/i);
      
      if (entryMatch) {
        const [_, entryNum, routineName, division, style, groupSize, studioStart, time] = entryMatch;
        
        // Check if studio name continues on next line
        let studioName = studioStart.trim();
        let nextLineIdx = i + 1;
        
        // Look ahead for studio name continuation (not starting with a number, not a time)
        while (
          nextLineIdx < lines.length &&
          lines[nextLineIdx] &&
          !lines[nextLineIdx].match(/^\d+\s/) && // Not a new entry
          !lines[nextLineIdx].match(/^\d{1,2}:\d{2}/) && // Not a time
          !lines[nextLineIdx].match(/^(SOLOBLAST|DUO|GROUP|COMPETITION)/i) && // Not a header
          lines[nextLineIdx].length > 0 &&
          lines[nextLineIdx].length < 50 // Studio names aren't super long
        ) {
          studioName += ' ' + lines[nextLineIdx].trim();
          nextLineIdx++;
        }
        
        // Update loop counter to skip processed lines
        i = nextLineIdx - 1;
        
        slots.push({
          entryNumber: entryNum.trim(),
          routineName: this.cleanText(routineName),
          division: this.normalizeDivision(division),
          style: this.normalizeStyle(style),
          groupSize: this.normalizeGroupSize(groupSize),
          studioName: this.cleanStudioName(studioName),
          day: currentDay,
          performanceTime: this.convertTo24Hour(time, currentSessionAMPM),
          stage: 'Main Stage',
          orderNumber: parseInt(entryNum),
          rawText: line
        });
      }
    }
    
    return slots;
  }

  parseConvention(text: string): ParsedConventionClass[] {
    const classes: ParsedConventionClass[] = [];
    const lines = text.split('\n').map(l => l.trim());
    
    // Column mapping for WCDE convention schedules
    const columns = {
      0: { division: 'Mini', ageRange: '8-10' },
      1: { division: 'Junior', ageRange: '11-12' },
      2: { division: 'Teen/Senior', ageRange: '13+' },
      3: { division: 'Breakout', ageRange: 'Advanced' }
    };
    
    let currentDay = 'Saturday';
    let inSchedule = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      // Day header: "Saturday Class Schedule" or "Sunday Class Schedule"
      const dayMatch = line.match(/(Saturday|Sunday)\s+Class\s+Schedule/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        inSchedule = true;
        continue;
      }
      
      // Column headers: "MINI JUNIOR TEEN/SENIOR BREAKOUT"
      if (/MINI\s+JUNIOR\s+TEEN/i.test(line)) {
        continue; // Just marks the table start
      }
      
      // Time row: "8:00-9:00" followed by class info
      const timeMatch = line.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*$/);
      if (timeMatch && inSchedule) {
        const startTime = timeMatch[1];
        const endTime = timeMatch[2];
        
        // Next line should have class details
        if (i + 1 < lines.length) {
          const classLine = lines[i + 1];
          
          // Parse columns separated by multiple spaces or pipes
          const cells = this.parseTableRow(classLine);
          
          cells.forEach((cellText, colIdx) => {
            if (!cellText || cellText === '—' || /break/i.test(cellText)) return;
            
            const classInfo = this.parseClassCell(cellText);
            if (!classInfo) return;
            
            const col = columns[colIdx] || columns[0];
            
            classes.push({
              className: classInfo.className,
              instructor: classInfo.instructor,
              room: col.division,
              day: currentDay,
              startTime: this.convertTo24Hour(startTime, this.inferAMPM(startTime)),
              endTime: this.convertTo24Hour(endTime, this.inferAMPM(endTime)),
              duration: this.calculateDuration(startTime, endTime),
              style: classInfo.style,
              division: col.division,
              ageRange: col.ageRange,
              level: 'All Levels',
              rawText: cellText
            });
          });
          
          i++; // Skip the class line we just processed
        }
      }
    }
    
    return classes;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private convertTo24Hour(time: string, ampm: string): string {
    const [hours, mins] = time.split(':').map(n => parseInt(n));
    let hour24 = hours;
    
    if (ampm.toUpperCase() === 'PM' && hour24 < 12) {
      hour24 += 12;
    } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private inferAMPM(time: string): string {
    const hour = parseInt(time.split(':')[0]);
    
    // Convention classes typically:
    // 7:30-2:20 → morning/afternoon
    // Before 7 is evening (19:00+)
    if (hour >= 7 && hour < 12) return 'AM';
    if (hour === 12) return 'PM';
    if (hour >= 1 && hour <= 6) return 'PM'; // 1:00-6:00 is afternoon
    
    return 'AM';
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(n => parseInt(n));
    const [endH, endM] = endTime.split(':').map(n => parseInt(n));
    
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    
    return endMins - startMins;
  }

  private parseTableRow(line: string): string[] {
    // Split on pipe or multiple spaces (3+)
    const cells = line.split(/\s{3,}|\|/).map(c => c.trim()).filter(c => c.length > 0);
    return cells;
  }

  private parseClassCell(cellText: string): { className: string; instructor: string; style: string | undefined } | null {
    if (!cellText || cellText === '—') return null;
    
    // Format: "Ballet | Tiffany Billings" or "Industry Jazz | Scott Myrick"
    const parts = cellText.split('|').map(p => p.trim());
    
    if (parts.length === 0) return null;
    
    const className = parts[0];
    const instructor = parts[1] || 'TBD';
    const style = this.extractStyle(className);
    
    return { className, instructor, style };
  }

  private extractStyle(className: string): string | undefined {
    const styleLower = className.toLowerCase();
    
    if (styleLower.includes('ballet')) return 'Ballet';
    if (styleLower.includes('jazz')) return 'Jazz';
    if (styleLower.includes('contemporary')) return 'Contemporary';
    if (styleLower.includes('tap')) return 'Tap';
    if (styleLower.includes('hip-hop') || styleLower.includes('hip hop')) return 'Hip Hop';
    if (styleLower.includes('lyrical')) return 'Lyrical';
    if (styleLower.includes('musical')) return 'Musical Theatre';
    
    return undefined;
  }

  private cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private cleanStudioName(text: string): string {
    // Remove common studio suffixes that might wrap
    return text
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+(Studio|School|Academy|Center|Dance)$/i, ' $1'); // Normalize spacing before suffix
  }

  private normalizeDivision(div: string): string {
    const lower = div.toLowerCase();
    if (lower.includes('mini')) return 'Mini';
    if (lower.includes('junior')) return 'Junior';
    if (lower.includes('teen')) return 'Teen';
    if (lower.includes('senior')) return 'Senior';
    return div;
  }

  private normalizeStyle(style: string): string {
    const lower = style.toLowerCase();
    if (lower === 'contemp') return 'Contemporary';
    if (lower === 'mus' || lower === 'musical') return 'Musical Theatre';
    if (lower === 'hiphop' || lower === 'hip-hop') return 'Hip Hop';
    return style;
  }

  private normalizeGroupSize(size: string): string {
    const lower = size.toLowerCase();
    if (lower.includes('duo') || lower.includes('trio')) return 'Duo/Trio';
    if (lower.includes('small')) return 'Small Group';
    if (lower.includes('large')) return 'Large Group';
    return size;
  }
}