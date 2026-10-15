import { describe, expect, it } from 'vitest';
import { REALTIME_DEV_DEFAULTS, isRealtimeProduction, realtimeEnvOrDevDefault } from './devDefaults';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('isRealtimeProduction', () => {
  it('is true only for a production build outside a dev machine', () => {
    expect(isRealtimeProduction(env({ NODE_ENV: 'production' }))).toBe(true);
    expect(isRealtimeProduction(env({ NODE_ENV: 'development' }))).toBe(false);
    expect(isRealtimeProduction(env({ NODE_ENV: 'production', LAWLESS_LOCAL: '1' }))).toBe(false);
  });
});

describe('realtimeEnvOrDevDefault', () => {
  const { internalUrl } = REALTIME_DEV_DEFAULTS;

  it('prefers the explicit value', () => {
    expect(realtimeEnvOrDevDefault('http://realtime:3008', internalUrl, env({ NODE_ENV: 'production' }))).toBe(
      'http://realtime:3008',
    );
  });

  it('falls back to the dev default outside production and with LAWLESS_LOCAL', () => {
    expect(realtimeEnvOrDevDefault(undefined, internalUrl, env({ NODE_ENV: 'development' }))).toBe(internalUrl);
    expect(
      realtimeEnvOrDevDefault(undefined, internalUrl, env({ NODE_ENV: 'production', LAWLESS_LOCAL: '1' })),
    ).toBe(internalUrl);
    expect(realtimeEnvOrDevDefault(undefined, internalUrl, env({ NODE_ENV: 'production' }))).toBeUndefined();
  });
});
