import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE_USERNAME,
  resolveRenderVariables,
} from './context';

describe('resolveRenderVariables', () => {
  it('injects username from context', () => {
    expect(
      resolveRenderVariables({
        inputs: {},
        username: 'Dr. Martin',
      })
    ).toEqual({ username: 'Dr. Martin' });
  });

  it('falls back to default username when empty', () => {
    expect(
      resolveRenderVariables({
        inputs: {},
        username: '   ',
      })
    ).toEqual({ username: DEFAULT_TEMPLATE_USERNAME });
  });

  it('lets explicit variables override username', () => {
    expect(
      resolveRenderVariables({
        inputs: {},
        username: 'Context Name',
        variables: { username: 'Override' },
      })
    ).toEqual({ username: 'Override' });
  });

  it('injects description from userDescription', () => {
    expect(
      resolveRenderVariables({
        inputs: {},
        userDescription: '  Directeur  ',
      })
    ).toEqual({ description: 'Directeur' });
  });

  it('keeps empty description for conditionals', () => {
    expect(
      resolveRenderVariables({
        inputs: {},
        userDescription: '',
      })
    ).toEqual({ description: '' });
  });
});
