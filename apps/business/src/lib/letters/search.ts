import type { Prisma } from '@prisma/client';
import { normalizeLetterSerial } from './serial';

/** Letters matching typed text: title, transcript, or the serial however it is typed. */
export function letterTextWhere(query: string): Prisma.LetterWhereInput {
  const text = query.trim();
  const serial = normalizeLetterSerial(text);
  return {
    OR: [
      { title: { contains: text, mode: 'insensitive' } },
      { transcript: { contains: text, mode: 'insensitive' } },
      { serial: { contains: text.toUpperCase() } },
      ...(serial ? [{ serial }] : []),
    ],
  };
}

const EXCERPT_RADIUS = 60;

/** « …text around the match… » of a transcript, or null when the match is not in it. */
export function excerptAround(text: string | null, query: string): string | null {
  if (!text) return null;
  const needle = query.trim().toLocaleLowerCase('fr');
  if (!needle) return null;
  const index = text.toLocaleLowerCase('fr').indexOf(needle);
  if (index < 0) return null;
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(text.length, index + needle.length + EXCERPT_RADIUS);
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`;
}
