import type { Prisma } from '@prisma/client';
import { normalizeLetterSerial } from './serial';

const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae' };

/** Lowercase, without accents (« Élise Cœur » → « elise coeur »): what the search compares. */
export function normalizeLetterSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[œæ]/g, (char) => LIGATURES[char] ?? char);
}

/** Serial without its dash, lowercased (« GM-576YYF » → « gm576yyf »): found when typed without the dash. */
export function compactSerial(serial: string): string {
  return serial.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Stored `Letter.searchText`: compact serial, title and transcript, normalized. */
export function letterSearchText(title: string, transcript: string | null | undefined, serial: string): string {
  return normalizeLetterSearch([compactSerial(serial), title, transcript?.trim()].filter(Boolean).join('\n'));
}

/** Stored `LetterCorrespondent.searchName`. */
export function correspondentSearchName(name: string): string {
  return normalizeLetterSearch(name);
}

/** Letters matching typed text, ignoring case and accents: title, transcript, or the serial however it is typed. */
export function letterTextWhere(query: string): Prisma.LetterWhereInput {
  const text = query.trim();
  const serial = normalizeLetterSerial(text);
  const normalized = normalizeLetterSearch(text);
  // A piece of serial typed without its dash (« gm 576 »); plain words are not glued together.
  const compact = /^[a-z0-9\s-]+$/.test(normalized) && /\d/.test(normalized) ? compactSerial(normalized) : null;
  return {
    OR: [
      { searchText: { contains: normalized } },
      ...(compact && compact !== normalized ? [{ searchText: { contains: compact } }] : []),
      { serial: { contains: text.toUpperCase() } },
      ...(serial ? [{ serial }] : []),
    ],
  };
}

/** Text normalized character by character, with the index in the original text of each normalized one. */
function normalizeWithIndex(text: string): { normalized: string; origin: number[] } {
  let normalized = '';
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const part = normalizeLetterSearch(text[index]);
    normalized += part;
    for (let k = 0; k < part.length; k += 1) origin.push(index);
  }
  return { normalized, origin };
}

const EXCERPT_RADIUS = 60;

/** « …text around the match… » of a transcript (case and accents ignored), or null when the match is not in it. */
export function excerptAround(text: string | null, query: string): string | null {
  if (!text) return null;
  const needle = normalizeLetterSearch(query.trim());
  if (!needle) return null;
  const { normalized, origin } = normalizeWithIndex(text);
  const found = normalized.indexOf(needle);
  if (found < 0) return null;
  const matchStart = origin[found];
  const matchEnd = origin[found + needle.length - 1] + 1;
  const start = Math.max(0, matchStart - EXCERPT_RADIUS);
  const end = Math.min(text.length, matchEnd + EXCERPT_RADIUS);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}
