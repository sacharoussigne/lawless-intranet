import { describe, expect, it } from 'vitest';
import {
  LETTER_EMBEDDING_DIMENSIONS,
  letterEmbeddingPassage,
  letterEmbeddingQuery,
  pickSemanticMatches,
  toVectorLiteral,
  wantsSemanticSearch,
} from './semantic';

describe('letter embedding text', () => {
  it('gives the model the title, the contact and the transcript with the e5 prefixes', () => {
    expect(letterEmbeddingPassage({ title: 'Lettre', correspondentName: 'George', transcript: '  veut oiseau ' })).toBe(
      'passage: Lettre\nGeorge\nveut oiseau',
    );
    expect(letterEmbeddingPassage({ title: 'Lettre', correspondentName: 'George', transcript: null })).toBe(
      'passage: Lettre\nGeorge',
    );
    expect(letterEmbeddingQuery(' il veut un oiseau ')).toBe('query: il veut un oiseau');
  });

  it('cuts long transcripts', () => {
    const passage = letterEmbeddingPassage({ title: 'T', correspondentName: 'G', transcript: 'x'.repeat(5000) });
    expect(passage.length).toBeLessThanOrEqual('passage: '.length + 2000);
  });
});

describe('toVectorLiteral', () => {
  it('writes a pgvector literal', () => {
    const vector = Array.from({ length: LETTER_EMBEDDING_DIMENSIONS }, (_, index) => index / 1000);
    expect(toVectorLiteral(vector)).toMatch(/^\[0,0\.001,0\.002,.*\]$/);
  });

  it('refuses a vector of the wrong size or with NaN', () => {
    expect(() => toVectorLiteral([1, 2])).toThrow();
    expect(() => toVectorLiteral(Array(LETTER_EMBEDDING_DIMENSIONS).fill(Number.NaN))).toThrow();
  });
});

describe('pickSemanticMatches', () => {
  it('keeps the neighbours close to the best one, best first', () => {
    const rows = [
      { id: 'a', score: 0.81 },
      { id: 'b', score: 0.86 },
      { id: 'c', score: 0.84 },
      { id: 'd', score: 0.79 },
    ];
    expect(pickSemanticMatches(rows, 10).map((row) => row.id)).toEqual(['b', 'c']);
    expect(pickSemanticMatches(rows, 1).map((row) => row.id)).toEqual(['b']);
  });

  it('keeps nothing below the floor', () => {
    expect(pickSemanticMatches([{ id: 'a', score: 0.7 }], 10)).toEqual([]);
    expect(pickSemanticMatches([], 10)).toEqual([]);
  });
});

describe('wantsSemanticSearch', () => {
  it('skips short queries and serials', () => {
    expect(wantsSemanticSearch('oiseau', false)).toBe(true);
    expect(wantsSemanticSearch('ois', false)).toBe(false);
    expect(wantsSemanticSearch('GM-576YYF', true)).toBe(false);
  });
});
