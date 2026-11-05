import { describe, expect, it } from 'vitest';
import { excerptAround, letterTextWhere } from './search';

describe('letterTextWhere', () => {
  it('matches the title, the transcript and the serial', () => {
    const where = letterTextWhere(' george ');
    expect(where.OR).toEqual([
      { title: { contains: 'george', mode: 'insensitive' } },
      { transcript: { contains: 'george', mode: 'insensitive' } },
      { serial: { contains: 'GEORGE' } },
    ]);
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
});
