import { describe, expect, it } from 'vitest';
import { generateLetterSerial, letterSerialPrefix, normalizeLetterSerial } from './serial';

describe('letterSerialPrefix', () => {
  it('takes the initials of the name', () => {
    expect(letterSerialPrefix('George Montgomery')).toBe('GM');
    expect(letterSerialPrefix('Jean-Pierre Dubois')).toBe('JPD');
    expect(letterSerialPrefix('Anna Maria de la Cruz')).toBe('AMD');
    expect(letterSerialPrefix('  élise   ândré ')).toBe('EA');
  });

  it('takes two letters of a single word', () => {
    expect(letterSerialPrefix('George')).toBe('GE');
    expect(letterSerialPrefix('X')).toBe('X');
  });

  it('falls back when the name has no letter', () => {
    expect(letterSerialPrefix('123 !')).toBe('LT');
    expect(letterSerialPrefix('')).toBe('LT');
  });
});

describe('generateLetterSerial', () => {
  it('writes the prefix and 6 unambiguous characters', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateLetterSerial('GM')).toMatch(/^GM-[2-9A-HJ-NP-Z]{6}$/);
    }
  });

  it('uses the given random source', () => {
    expect(generateLetterSerial('LT', () => 0)).toBe('LT-222222');
    expect(generateLetterSerial('JPD', () => 0.9999)).toBe('JPD-ZZZZZZ');
  });
});

describe('normalizeLetterSerial', () => {
  it('reads what people type', () => {
    expect(normalizeLetterSerial('gm-7k3q9p')).toBe('GM-7K3Q9P');
    expect(normalizeLetterSerial('GM 7K3Q9P')).toBe('GM-7K3Q9P');
    expect(normalizeLetterSerial('jpd7k3q9p')).toBe('JPD-7K3Q9P');
    expect(normalizeLetterSerial('lt-7k3q9p')).toBe('LT-7K3Q9P');
  });

  it('refuses what cannot be a serial', () => {
    expect(normalizeLetterSerial('7K3Q9P')).toBeNull();
    expect(normalizeLetterSerial('George')).toBeNull();
    expect(normalizeLetterSerial('GM-7K3')).toBeNull();
    expect(normalizeLetterSerial('GM-0O1I23')).toBeNull();
    expect(normalizeLetterSerial('ABCD-7K3Q9P')).toBeNull();
  });
});
