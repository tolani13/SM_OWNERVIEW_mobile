/**
 * Competition Run Sheet Parser (comp_parser)
 * Company-agnostic: works with any dance competition PDF run sheet format.
 *
 * Strategy:
 *   1. Extract raw text lines from the PDF.
 *   2. Track day and AM/PM context from headers.
 *   3. For each entry line, find the METADATA CLUSTER — the contiguous span
 *      where division + style + groupSize tokens appear together. Everything
 *      before the cluster is the routine name. Everything after is the studio.
 *   4. Two-pass studio resolution: Pass 1 parses all entries and builds a
 *      studio registry. Pass 2 re-processes entries with no studio match
 *      using the now-complete registry.
 *   5. Multi-line lookahead for wrapped studio/routine names.
 *
 * Conforms to ParserStrategy so it drops into the existing orchestrator.
 */

import type {
  ParserStrategy,
  ParsedRunSlot,
  ParsedConventionClass,
  CompanyType,
} from '../types';
import {
  VALID_DIVISIONS,
} from '../types';
import { cleanText } from '../utils';

// ─── vocabulary sets (lower-cased for matching) ───────────────────────────────

/** All division tokens, longest first so "PreTeen" beats "Teen". */
const DIVISION_TOKENS: string[] = [...VALID_DIVISIONS]
  .sort((a, b) => b.length - a.length);

/** Style tokens — includes common PDF variants. */
const STYLE_TOKENS: string[] = [
  'Musical Theatre',
  'Musical Theater',
  'Hip Hop',
  'Hip-Hop',
  'Wild Card',
  'Contemporary',
  'Lyrical',
  'Ballet',
  'Jazz',
  'Tap',
  'Open',
  'Acro',
  'Modern',
  'Fusion',
  'Musical',
  'Pointe',
  'Clogging',
  'Character',
].sort((a, b) => b.length - a.length);

/** Group-size tokens, longest first. */
const GROUP_SIZE_TOKENS: string[] = [
  'Large Group',
  'Small Group',
  'Duo/Trio',
  'Production',
  'Solo',
  'Line',
  'Duet',
  'Trio',
].sort((a, b) => b.length - a.length);

/** Lines that should never be treated as entry data. */
const SKIP_PATTERNS: RegExp[] = [
  /^#?\s*Name\b/i,
  /^Time\s/i,
  /^Entry/i,
  /COMPETITION\s+BREAK/i,
  /COMPETITION\s+AWARDS/i,
  /^AWARDS/i,
  /^BREAK/i,
  /^LUNCH/i,
  /Set\s+for\s+Competition/i,
  /Dressing\s+Rooms?\s+Open/i,
  /Studio\s+Icon/i,
  /^Division\s+Style/i,
  /^\s*#\s+Name\s/i,
];

/** Studio indicator words — used in pass 1 for heuristic splitting. */
const STUDIO_INDICATORS = [
  'Dance', 'Academy', 'School', 'Center', 'Centre', 'Studio',
  'Conservatory', 'Theatre', 'Theater', 'Company', 'Complex',
  'Movement', 'Arts', 'Performing',
];

// ─── types for internal intermediate representation ───────────────────────────

interface RawEntry {
  entryNum: number;
  rawText: string;
  body: string;
  lookahead: string;
  timeStr: string;
  ampm: string;
  day: string;
}

interface TokenSpan {
  start: number;
  end: number;
  raw: string;
  field: 'division' | 'style' | 'groupSize';
}

// ─── helper: case-insensitive indexOf ─────────────────────────────────────────
function ciIndexOf(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

// ─── helper: find all vocabulary token positions in a string ──────────────────
function findAllTokenSpans(text: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const lower = text.toLowerCase();

  const search = (tokens: string[], field: TokenSpan['field']) => {
    for (const token of tokens) {
      const tokenLower = token.toLowerCase();
      let searchFrom = 0;
      while (searchFrom < lower.length) {
        const idx = lower.indexOf(tokenLower, searchFrom);
        if (idx === -1) break;
        const endIdx = idx + token.length;
        const before = idx === 0 || /\s/.test(text[idx - 1]);
        const after = endIdx >= text.length || /\s/.test(text[endIdx]);
        if (before && after) {
          // Don't add if this span overlaps ANY already-found span
          const overlaps = spans.some(
            s => idx < s.end && endIdx > s.start,
          );
          if (!overlaps) {
            spans.push({ start: idx, end: endIdx, raw: token, field });
          }
        }
        searchFrom = idx + 1;
      }
    }
  };

  search(DIVISION_TOKENS, 'division');
  search(STYLE_TOKENS, 'style');
  search(GROUP_SIZE_TOKENS, 'groupSize');

  spans.sort((a, b) => a.start - b.start);
  return spans;
}

// ─── helper: find the tightest cluster of div+style+groupSize ─────────────────
function findMetadataCluster(
  _text: string,
  spans: TokenSpan[],
): {
  clusterStart: number;
  clusterEnd: number;
  division: string | null;
  style: string | null;
  groupSize: string | null;
} | null {
  if (spans.length === 0) return null;

  if (spans.length === 1) {
    const s = spans[0];
    return {
      clusterStart: s.start,
      clusterEnd: s.end,
      division: s.field === 'division' ? s.raw : null,
      style: s.field === 'style' ? s.raw : null,
      groupSize: s.field === 'groupSize' ? s.raw : null,
    };
  }

  const MAX_GAP = 4;
  const clusters: TokenSpan[][] = [];
  let current: TokenSpan[] = [spans[0]];

  for (let i = 1; i < spans.length; i++) {
    const prev = current[current.length - 1];
    const gap = spans[i].start - prev.end;
    if (gap <= MAX_GAP) {
      current.push(spans[i]);
    } else {
      clusters.push(current);
      current = [spans[i]];
    }
  }
  clusters.push(current);

  let best: TokenSpan[] | null = null;
  let bestScore = 0;

  for (const cluster of clusters) {
    const fields = new Set(cluster.map(s => s.field));
    const score = fields.size;
    if (score > bestScore) {
      bestScore = score;
      best = cluster;
    }
  }

  if (!best) return null;

  const clusterStart = best[0].start;
  const clusterEnd = best[best.length - 1].end;

  let division: string | null = null;
  let style: string | null = null;
  let groupSize: string | null = null;

  for (const span of best) {
    if (span.field === 'division' && (!division || span.raw.length > division.length)) {
      division = span.raw;
    }
    if (span.field === 'style' && (!style || span.raw.length > style.length)) {
      style = span.raw;
    }
    if (span.field === 'groupSize' && (!groupSize || span.raw.length > groupSize.length)) {
      groupSize = span.raw;
    }
  }

  return { clusterStart, clusterEnd, division, style, groupSize };
}

// ─── the parser ───────────────────────────────────────────────────────────────

export class CompParser implements ParserStrategy {
  company: CompanyType = 'unknown';

  canParse(_text: string): boolean {
    return true;
  }

  // ==========================================================================
  //  RUN SHEET — two-pass with cluster detection
  // ==========================================================================

  parseRunSheet(text: string): ParsedRunSlot[] {
    const lines = text.split('\n');

    // ── Phase 0: extract raw entries with context ──
    const rawEntries: RawEntry[] = [];
    let currentDay = '';
    let currentAMPM = 'AM';

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) continue;
      if (SKIP_PATTERNS.some(p => p.test(line))) continue;

      // Day headers
      const dayMatch = line.match(
        /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
      );
      if (
        dayMatch &&
        (line.includes('-') ||
          /schedule|class|session|january|february|march|april|may|june|july|august|september|october|november|december/i.test(line))
      ) {
        currentDay =
          dayMatch[1].charAt(0).toUpperCase() +
          dayMatch[1].slice(1).toLowerCase();
        continue;
      }

      // Session header AM/PM
      const ampmMatch = line.match(/(\d{1,2}:\d{2})\s*(AM|PM)/i);
      if (ampmMatch && /COMPETITION|SESSION|DIVISION|AGE/i.test(line)) {
        currentAMPM = ampmMatch[2].toUpperCase();
        continue;
      }

      // Entry line: starts with digits
      const entryStart = line.match(/^(\d+)\s+(.+)$/);
      if (!entryStart) continue;

      const entryNum = parseInt(entryStart[1], 10);
      if (entryNum > 9999) continue;

      let rest = entryStart[2].trim();

      // Extract time (last token HH:MM)
      let timeStr = '';
      const timeMatch = rest.match(/\s+(\d{1,2}:\d{2})\s*$/);
      if (timeMatch) {
        timeStr = timeMatch[1];
        rest = rest.slice(0, timeMatch.index!).trimEnd();
      }

      // AM/PM inference
      let ampm = currentAMPM;
      if (timeStr) {
        const hour = parseInt(timeStr.split(':')[0], 10);
        if (hour >= 1 && hour <= 6) ampm = 'PM';
        else if (hour === 12) ampm = 'PM';
      }

      // Multi-line lookahead
      let lookahead = '';
      let nextIdx = i + 1;
      while (
        nextIdx < lines.length &&
        lines[nextIdx].trim().length > 0 &&
        lines[nextIdx].trim().length < 60 &&
        !/^\d+\s/.test(lines[nextIdx].trim()) &&
        !SKIP_PATTERNS.some(p => p.test(lines[nextIdx].trim())) &&
        !/^(SOLOBLAST|DUO|GROUP|COMPETITION|AWARDS|BREAK)/i.test(lines[nextIdx].trim()) &&
        !/^\d{1,2}:\d{2}/.test(lines[nextIdx].trim())
      ) {
        lookahead += ' ' + lines[nextIdx].trim();
        nextIdx++;
      }
      if (lookahead.trim().length > 0) {
        i = nextIdx - 1;
      }

      if (!currentDay) currentDay = 'Friday';

      rawEntries.push({
        entryNum,
        rawText: raw.trim(),
        body: rest,
        lookahead: lookahead.trim(),
        timeStr,
        ampm,
        day: currentDay,
      });
    }

    // ── Phase 1: parse entries, build studio registry ──
    const studioRegistry: Set<string> = new Set();

    interface ParsedEntry {
      raw: RawEntry;
      routineName: string;
      division: string;
      style: string;
      groupSize: string;
      studioName: string;
      studioConfident: boolean;
    }

    const parsed: ParsedEntry[] = [];

    for (const entry of rawEntries) {
      const combined = (entry.body + (entry.lookahead ? ' ' + entry.lookahead : '')).trim();
      const result = this.parseEntryBody(combined, studioRegistry);

      if (result.studioName.length > 2 && result.studioConfident) {
        studioRegistry.add(result.studioName);
      }

      parsed.push({ raw: entry, ...result });
    }

    // ── Phase 2: re-process entries with unconfident studios ──
    for (const entry of parsed) {
      if (entry.studioConfident && entry.studioName.length > 0) continue;

      const combined = (entry.raw.body + (entry.raw.lookahead ? ' ' + entry.raw.lookahead : '')).trim();
      const retry = this.parseEntryBody(combined, studioRegistry);

      if (retry.studioConfident && retry.studioName.length > 0) {
        entry.routineName = retry.routineName;
        entry.division = retry.division;
        entry.style = retry.style;
        entry.groupSize = retry.groupSize;
        entry.studioName = retry.studioName;
        entry.studioConfident = true;
      }
    }

    // ── Phase 3: build final slots ──
    const slots: ParsedRunSlot[] = [];

    for (const entry of parsed) {
      let performanceTime = '';
      if (entry.raw.timeStr) {
        const [h, m] = entry.raw.timeStr.split(':').map(Number);
        let hour24 = h;
        if (entry.raw.ampm === 'PM' && hour24 < 12) hour24 += 12;
        if (entry.raw.ampm === 'AM' && hour24 === 12) hour24 = 0;
        performanceTime = `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }

      slots.push({
        entryNumber: String(entry.raw.entryNum),
        routineName: cleanText(entry.routineName),
        division: entry.division,
        style: entry.style,
        groupSize: entry.groupSize || 'Solo',
        studioName: this.cleanStudioName(entry.studioName),
        day: entry.raw.day,
        performanceTime,
        stage: 'Main Stage',
        orderNumber: entry.raw.entryNum,
        rawText: entry.raw.rawText,
      });
    }

    return slots;
  }

  // ==========================================================================
  //  CONVENTION — not this parser's domain, return empty
  // ==========================================================================

  parseConvention(_text: string): ParsedConventionClass[] {
    return [];
  }

  // ==========================================================================
  //  CORE: parse entry body using cluster detection + registry lookup
  // ==========================================================================

  private parseEntryBody(
    text: string,
    studioRegistry: Set<string>,
  ): {
    routineName: string;
    division: string;
    style: string;
    groupSize: string;
    studioName: string;
    studioConfident: boolean;
  } {
    const spans = findAllTokenSpans(text);
    const cluster = findMetadataCluster(text, spans);

    if (!cluster) {
      const studioResult = this.findStudioInText(text, studioRegistry);
      return {
        routineName: studioResult ? studioResult.remainder : text,
        division: '',
        style: '',
        groupSize: '',
        studioName: studioResult ? studioResult.studio : '',
        studioConfident: studioResult ? studioResult.confident : false,
      };
    }

    const beforeCluster = text.slice(0, cluster.clusterStart).trim();
    const afterCluster = text.slice(cluster.clusterEnd).trim();

    let routineName = beforeCluster;
    let studioName = afterCluster;
    let studioConfident = false;

    if (afterCluster.length > 0) {
      const registryMatch = this.findStudioInText(afterCluster, studioRegistry);
      if (registryMatch && registryMatch.confident) {
        studioName = registryMatch.studio;
        studioConfident = true;
        const leftover = registryMatch.remainder.trim();
        if (leftover.length > 0) {
          routineName = (routineName + ' ' + leftover).trim();
        }
      } else {
        const heuristic = this.detectStudioHeuristic(afterCluster);
        if (heuristic) {
          studioName = heuristic.studio;
          studioConfident = heuristic.confident;
          const leftover = heuristic.remainder.trim();
          if (leftover.length > 0) {
            routineName = (routineName + ' ' + leftover).trim();
          }
        } else {
          studioName = afterCluster;
          studioConfident = false;
        }
      }
    } else {
      studioName = '';
      studioConfident = false;
    }

    return {
      routineName,
      division: cluster.division ? this.normalizeDivision(cluster.division) : '',
      style: cluster.style ? this.normalizeStyle(cluster.style) : '',
      groupSize: cluster.groupSize ? this.normalizeGroupSize(cluster.groupSize) : '',
      studioName,
      studioConfident,
    };
  }

  // ==========================================================================
  //  STUDIO DETECTION
  // ==========================================================================

  private findStudioInText(
    text: string,
    registry: Set<string>,
  ): { studio: string; remainder: string; confident: boolean } | null {
    for (const known of registry) {
      const idx = ciIndexOf(text, known);
      if (idx !== -1) {
        const before = text.slice(0, idx).trim();
        const after = text.slice(idx + known.length).trim();
        return {
          studio: known,
          remainder: (before + ' ' + after).trim(),
          confident: true,
        };
      }
    }
    return null;
  }

  private detectStudioHeuristic(
    text: string,
  ): { studio: string; remainder: string; confident: boolean } | null {
    let bestSplit = -1;

    for (const indicator of STUDIO_INDICATORS) {
      const idx = ciIndexOf(text, indicator);
      if (idx < 0) continue;

      let startIdx = idx;
      while (startIdx > 0 && !/\s/.test(text[startIdx - 1])) {
        startIdx--;
      }

      let probeIdx = startIdx - 1;
      while (probeIdx > 0) {
        while (probeIdx > 0 && /\s/.test(text[probeIdx])) probeIdx--;
        if (probeIdx <= 0) break;

        const wordEnd = probeIdx + 1;
        while (probeIdx > 0 && !/\s/.test(text[probeIdx - 1])) probeIdx--;
        const word = text.slice(probeIdx, wordEnd);

        if (this.isVocabularyWord(word)) break;

        if (/^[A-Z0-9]/.test(word) || /^['"(]/.test(word)) {
          startIdx = probeIdx;
        } else {
          break;
        }
        probeIdx--;
      }

      if (bestSplit === -1 || startIdx < bestSplit) {
        if (startIdx >= 0) bestSplit = startIdx;
      }
    }

    if (bestSplit >= 0) {
      const studio = text.slice(bestSplit).trim();
      const remainder = text.slice(0, bestSplit).trim();
      return { studio, remainder, confident: studio.length > 3 };
    }

    return null;
  }

  private isVocabularyWord(word: string): boolean {
    const lower = word.toLowerCase();
    return (
      DIVISION_TOKENS.some(d => d.toLowerCase() === lower) ||
      STYLE_TOKENS.some(s => s.toLowerCase() === lower) ||
      GROUP_SIZE_TOKENS.some(g => g.toLowerCase() === lower)
    );
  }

  // ==========================================================================
  //  NORMALIZERS
  // ==========================================================================

  private normalizeStyle(style: string): string {
    const lower = style.toLowerCase();
    if (lower.includes('musical')) return 'Musical Theater';
    if (lower === 'hip-hop' || lower === 'hip hop' || lower === 'hiphop') return 'Hip Hop';
    if (lower === 'contemp') return 'Contemporary';
    if (lower === 'lyric') return 'Lyrical';
    return style
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private normalizeDivision(div: string): string {
    const lower = div.toLowerCase();
    if (lower.includes('mini')) return 'Mini';
    if (lower.includes('spark')) return 'Spark';
    if (lower.includes('preteen') || lower.includes('pre-teen')) return 'PreTeen';
    if (lower.includes('junior') || lower === 'jr') return 'Junior';
    if (lower.includes('intermediate') || lower === 'inter') return 'Intermediate';
    if (lower.includes('teen')) return 'Teen';
    if (lower.includes('senior') || lower === 'sr') return 'Senior';
    return div;
  }

  private normalizeGroupSize(size: string): string {
    const lower = size.toLowerCase();
    if (lower.includes('duo') || lower.includes('trio') || lower.includes('duet')) return 'Duo/Trio';
    if (lower.includes('small')) return 'Small Group';
    if (lower.includes('large')) return 'Large Group';
    if (lower.includes('prod')) return 'Production';
    if (lower.includes('line')) return 'Line';
    return size;
  }

  private cleanStudioName(text: string): string {
    return text.replace(/\s+/g, ' ').trim().replace(/[,;:]+$/, '').trim();
  }
}
