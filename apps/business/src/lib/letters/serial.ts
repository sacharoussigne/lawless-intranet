/** Serial number written on a paper letter, to find it again in a chest (« LT-7K3Q9P »). */

/** No 0/O nor 1/I: easy to read back from a handwritten label. */
const SERIAL_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SERIAL_LENGTH = 6;
export const SERIAL_PREFIX = 'LT-';

export function generateLetterSerial(random: () => number = Math.random): string {
  let code = '';
  for (let index = 0; index < SERIAL_LENGTH; index += 1) {
    code += SERIAL_ALPHABET[Math.floor(random() * SERIAL_ALPHABET.length)];
  }
  return `${SERIAL_PREFIX}${code}`;
}

/** Serial typed by someone (« lt 7k3q9p », « 7K3Q9P ») → stored form, or null when it cannot be one. */
export function normalizeLetterSerial(input: string): string | null {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^LT/, '');
  if (compact.length !== SERIAL_LENGTH) return null;
  if (![...compact].every((char) => SERIAL_ALPHABET.includes(char))) return null;
  return `${SERIAL_PREFIX}${compact}`;
}
