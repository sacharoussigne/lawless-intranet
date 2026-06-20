import { describe, expect, it } from 'vitest';
import { processConditionalBlocks } from './conditions';

describe('processConditionalBlocks', () => {
  it('uses empty branch when variable is missing', () => {
    const result = processConditionalBlocks(
      '{if:[var="description"][empty="Madame, Monsieur,"][filled="Grade: ${description}"]}',
      {},
    );
    expect(result).toBe('Madame, Monsieur,');
  });

  it('uses empty branch when variable is blank', () => {
    const result = processConditionalBlocks(
      '{if:[var="description"][empty="A"][filled="B ${description}"]}',
      { description: '   ' },
    );
    expect(result).toBe('A');
  });

  it('uses filled branch when variable has a value', () => {
    const result = processConditionalBlocks(
      '{if:[var="description"][empty="A"][filled="Grade: ${description}"]}',
      { description: 'Co-directrice' },
    );
    expect(result).toBe('Grade: ${description}');
  });

  it('supports escaped newlines in branches', () => {
    const result = processConditionalBlocks(
      '{if:[var="description"][empty="Line1\\nLine2"][filled="X"]}',
      {},
    );
    expect(result).toBe('Line1\nLine2');
  });

  it('matches variables case-insensitively', () => {
    const result = processConditionalBlocks(
      '{if:[var="Description"][empty="A"][filled="B"]}',
      { description: 'Directeur' },
    );
    expect(result).toBe('B');
  });

  it('uses then branch when variable equals eq (case-insensitive)', () => {
    const result = processConditionalBlocks(
      '{if:[var="gender"][eq="female"][then="Je soussignée"][else="Je soussigné"]}',
      { gender: 'female' },
    );
    expect(result).toBe('Je soussignée');
  });

  it('uses else branch when variable does not equal eq', () => {
    const result = processConditionalBlocks(
      '{if:[var="gender"][eq="female"][then="Je soussignée"][else="Je soussigné"]}',
      { gender: 'male' },
    );
    expect(result).toBe('Je soussigné');
  });

  it('matches eq case-insensitively', () => {
    const result = processConditionalBlocks(
      '{if:[var="Gender"][eq="Female"][then="A"][else="B"]}',
      { gender: 'female' },
    );
    expect(result).toBe('A');
  });
});
