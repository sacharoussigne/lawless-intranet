import { describe, expect, it } from 'vitest';
import { excerptAround, letterSearchText, letterTextWhere, normalizeLetterSearch } from './search';

describe('normalizeLetterSearch', () => {
  it('drops case, accents and ligatures', () => {
    expect(normalizeLetterSearch('Élise ANDRÉ')).toBe('elise andre');
    expect(normalizeLetterSearch('Cœur Ægir')).toBe('coeur aegir');
  });

  it('builds the stored search text from the title and the transcript', () => {
    expect(letterSearchText('Théâtre', '  Le Cœur  ')).toBe('theatre\nle coeur');
    expect(letterSearchText('Théâtre', null)).toBe('theatre');
  });
});

describe('letterTextWhere', () => {
  it('matches the normalized text and the serial', () => {
    const where = letterTextWhere(' Élise ');
    expect(where.OR).toEqual([{ searchText: { contains: 'elise' } }, { serial: { contains: 'ÉLISE' } }]);
  });

  it('finds a serial typed loosely', () => {
    expect(letterTextWhere('lt 7k3q9p').OR).toContainEqual({ serial: 'LT-7K3Q9P' });
  });
});

describe('excerptAround', () => {
  const text = `${'a'.repeat(100)} le colis de George arrive mardi ${'b'.repeat(100)}`;

  it('cuts the transcript around the match', () => {
    const excerpt = excerptAround(text, 'GEORGE');
    expect(excerpt).toMatch(/^…a+ le colis de George arrive mardi b+…$/);
    expect(excerpt?.length ?? 0).toBeLessThan(150);
  });

  it('is null without a match', () => {
    expect(excerptAround(text, 'Jess')).toBeNull();
    expect(excerptAround(null, 'George')).toBeNull();
    expect(excerptAround('Bonjour George', 'George')).toBe('Bonjour George');
  });

  it('ignores accents and keeps the original text', () => {
    expect(excerptAround('Rendez-vous au Théâtre ce soir', 'theatre')).toBe('Rendez-vous au Théâtre ce soir');
    const long = `${'a'.repeat(100)} mon cœur ${'b'.repeat(100)}`;
    expect(excerptAround(long, 'COEUR')).toMatch(/^…a+ mon cœur b+…$/);
  });
});
