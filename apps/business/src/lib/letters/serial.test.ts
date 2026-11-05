import { describe, expect, it } from 'vitest';
import { generateLetterSerial, normalizeLetterSerial } from './serial';

describe('generateLetterSerial', () => {
  it('writes LT- and 6 unambiguous characters', () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateLetterSerial()).toMatch(/^LT-[2-9A-HJ-NP-Z]{6}$/);
    }
  });

  it('uses the given random source', () => {
    expect(generateLetterSerial(() => 0)).toBe('LT-222222');
    expect(generateLetterSerial(() => 0.9999)).toBe('LT-ZZZZZZ');
  });
});

describe('normalizeLetterSerial', () => {
  it('reads what people type', () => {
    expect(normalizeLetterSerial('lt-7k3q9p')).toBe('LT-7K3Q9P');
    expect(normalizeLetterSerial('LT 7K3Q9P')).toBe('LT-7K3Q9P');
    expect(normalizeLetterSerial('7k3q9p')).toBe('LT-7K3Q9P');
  });

  it('refuses what cannot be a serial', () => {
    expect(normalizeLetterSerial('George')).toBeNull();
    expect(normalizeLetterSerial('LT-7K3Q9')).toBeNull();
    expect(normalizeLetterSerial('LT-0O1I23')).toBeNull();
  });
});
