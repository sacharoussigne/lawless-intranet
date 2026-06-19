import { describe, expect, it } from 'vitest';
import { extractVariables, substituteVariables } from './variables';

describe('extractVariables', () => {
  it('returns unique variable names in order of first appearance', () => {
    const content = 'Hello ${name}, items:\n${items}\nBy ${username}';
    expect(extractVariables(content)).toEqual(['name', 'items', 'username']);
  });

  it('returns empty array when no variables', () => {
    expect(extractVariables('plain text')).toEqual([]);
  });
});

describe('substituteVariables', () => {
  it('replaces known variables', () => {
    expect(
      substituteVariables('${name} - ${price}', {
        name: 'Client',
        price: '10.00 $',
      })
    ).toBe('Client - 10.00 $');
  });

  it('leaves unknown placeholders intact', () => {
    expect(substituteVariables('${missing}', {})).toBe('${missing}');
  });

  it('resolves variables case-insensitively', () => {
    expect(
      substituteVariables('Hello ${USERNAME}', { username: 'Dr. Martin' })
    ).toBe('Hello Dr. Martin');
  });
});
