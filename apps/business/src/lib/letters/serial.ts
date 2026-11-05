/**
 * Serial number written on a paper letter, to find it again in a chest: initials of the
 * correspondent, then a random code (« GM-7K3Q9P » for George Montgomery).
 */

/** No 0/O nor 1/I: easy to read back from a handwritten label. */
const SERIAL_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SERIAL_LENGTH = 6;
const MAX_PREFIX_LENGTH = 3;
/** Prefix when the name gives no letter (and of the first letters, before initials). */
export const DEFAULT_SERIAL_PREFIX = 'LT';

/** « George Montgomery » → GM, « Jean-Pierre Dubois » → JPD, « George » → GE. */
export function letterSerialPrefix(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  const [first] = words;
  if (!first) return DEFAULT_SERIAL_PREFIX;
  if (words.length === 1) return first.slice(0, 2);
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, MAX_PREFIX_LENGTH);
}

export function generateLetterSerial(prefix: string, random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < SERIAL_LENGTH; index += 1) {
    code += SERIAL_ALPHABET[Math.floor(random() * SERIAL_ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}

/** Serial typed by someone (« gm 7k3q9p », « GM-7K3Q9P ») → stored form, or null when it cannot be one. */
export function normalizeLetterSerial(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = compact.slice(0, -SERIAL_LENGTH);
  const code = compact.slice(-SERIAL_LENGTH);
  if (!/^[A-Z]{1,3}$/.test(prefix) || code.length !== SERIAL_LENGTH) return null;
  if (![...code].every((char) => SERIAL_ALPHABET.includes(char))) return null;
  return `${prefix}-${code}`;
}
