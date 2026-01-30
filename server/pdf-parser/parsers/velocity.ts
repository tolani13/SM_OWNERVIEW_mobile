/**
 * Velocity Dance Conventions Parser
 * Handles:
 * - Competition Run Sheets: Time, Entry#, Name, Division Style, Studio, Dancer
 * - Convention Schedules: Two-column Mini/Junior/Inter vs Teen/Senior with time format "7:00-8:00 AM"
 */

import type { ParserStrategy, ParsedRunSlot, ParsedConventionClass } from '../types';
import {
  normalizeTime,
  parseTimeRange,
  cleanText,
  extractDay,
  matchDivision,
  matchStyle,
  matchGroupSize,
  extractInstructor,
  extractAgeRange
} from '../utils';

export class VelocityParser implements ParserStrategy {
  company = 'velocity' as const;

  canParse(text: string): boolean {
    const normalized = text.toLowerCase();
    return normalized.includes('velocity') ||
           (normalized.includes('entry#') && normalized.includes('dancer'));
  }

  parseRunSheet(text: string): ParsedRunSlot[] {
    const slots: ParsedRunSlot[] = [];
    const lines = text.split('\n');
    
    let orderNum = 1;
    let currentDay = 'Friday';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 10) continue;
      
      const dayMatch = line.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }
      
      if (/^(AWARDS|BREAK|LUNCH)/i.test(line)) continue;
      if (line.toLowerCase().includes('time') && line.toLowerCase().includes('entry')) continue;
      
      const parts = line.split(/[|\t]/).map(p => cleanText(p));
      
      if (parts.length >= 5) {
        const timeText = parts[0];
        const entryNumber = parts[1];
        const routineName = parts[2];
        const divisionStyleText = parts[3];
        const studioName = parts[4];
        
        if (!timeText.match(/\d+:\d+/) || !routineName) continue;
        
        const division = matchDivision(divisionStyleText);
        const style = matchStyle(divisionStyleText);
        const groupSize = matchGroupSize(routineName) || matchGroupSize(divisionStyleText) || 'Solo';
        
        if (routineName && division && style && studioName) {
          try {
            const performanceTime = normalizeTime(timeText);
            
            slots.push({
              entryNumber: entryNumber || undefined,
              routineName: cleanText(routineName),
              division,
              style,
              groupSize,
              studioName: cleanText(studioName),
              day: currentDay,
              performanceTime,
              stage: 'Main Stage',
              orderNumber: orderNum++,
              rawText: line
            });
          } catch (error) {
            console.warn(`Failed to parse Velocity run slot: ${line}`, error);
          }
        }
      }
    }
    
    return slots;
  }

  parseConvention(text: string): ParsedConventionClass[] {
    const classes: ParsedConventionClass[] = [];
    const lines = text.split('\n');
    
    let currentDay = 'Friday';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const dayMatch = line.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }
      
      const timeMatch = line.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (timeMatch) {
        const timeRange = parseTimeRange(timeMatch[0]);
        if (!timeRange) continue;
        
        const parts = line.split(/\s{4,}|\|/).map(p => cleanText(p));
        
        for (let colIdx = 1; colIdx < parts.length; colIdx++) {
          const cellText = parts[colIdx];
          if (!cellText || cellText.length < 3) continue;
          
          const commaParts = cellText.split(',').map(p => cleanText(p));
          
          let className = commaParts[0];
          let instructor = commaParts[1] || extractInstructor(cellText) || 'TBD';
          
          if (!commaParts[1]) {
            const dashParts = cellText.split(/[-–]/).map(p => cleanText(p));
            if (dashParts.length >= 2) {
              className = dashParts[0];
              instructor = dashParts[1];
            }
          }
          
          if (className && instructor) {
            const style = matchStyle(className);
            const division = colIdx === 1 ? 'Junior' : 'Teen';
            const ageRange = colIdx === 1 ? '8-12' : '13+';
            
            classes.push({
              className: cleanText(className),
              instructor: cleanText(instructor),
              room: `Studio ${colIdx}`,
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
