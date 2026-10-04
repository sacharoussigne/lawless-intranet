import { describe, expect, it } from 'vitest';
import { REALTIME_DEV_DEFAULTS } from '@lawless-intranet/realtime';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('needs no configuration outside production', () => {
    const config = loadConfig({ NODE_ENV: 'development' });
    expect(config).toMatchObject({
      wsPort: REALTIME_DEV_DEFAULTS.wsPort,
      internalPort: REALTIME_DEV_DEFAULTS.internalPort,
      allowedOrigins: [],
      tokenSecret: REALTIME_DEV_DEFAULTS.tokenSecret,
      internalSecret: REALTIME_DEV_DEFAULTS.internalSecret,
      production: false,
    });
  });

  it('treats empty secrets as unset in development', () => {
    const config = loadConfig({ REALTIME_TOKEN_SECRET: '', REALTIME_INTERNAL_SECRET: '' });
    expect(config.tokenSecret).toBe(REALTIME_DEV_DEFAULTS.tokenSecret);
  });

  it('requires origins and secrets in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'ALLOWED_ORIGINS, REALTIME_TOKEN_SECRET, REALTIME_INTERNAL_SECRET required in production',
    );
  });

  it('uses explicit production values', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://dispensaire.example.com/, https://refuge.example.com',
      REALTIME_TOKEN_SECRET: 'prod-token-secret-0123',
      REALTIME_INTERNAL_SECRET: 'prod-internal-secret-0123',
    });
    expect(config).toMatchObject({
      allowedOrigins: ['https://dispensaire.example.com', 'https://refuge.example.com'],
      tokenSecret: 'prod-token-secret-0123',
      internalSecret: 'prod-internal-secret-0123',
      production: true,
    });
  });

  it('rejects secrets that are too short', () => {
    expect(() => loadConfig({ REALTIME_TOKEN_SECRET: 'short' })).toThrow('at least 16 characters');
  });
});
