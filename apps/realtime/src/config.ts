import { z } from 'zod';
import { REALTIME_DEV_DEFAULTS } from '@lawless-intranet/realtime';

const portSchema = z.coerce.number().int().min(0).max(65535);

/** Optional secret; an empty value (`KEY=` in .env) counts as unset. */
function optionalSecret(name: string) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(16, `${name} must be at least 16 characters`).optional(),
  );
}

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  HOST: z.string().default('0.0.0.0'),
  /** Public websocket port (routed by nginx-proxy in production). */
  WS_PORT: portSchema.default(REALTIME_DEV_DEFAULTS.wsPort),
  /** Internal HTTP port for services (/publish, /revoke). Never routed publicly. */
  INTERNAL_PORT: portSchema.default(REALTIME_DEV_DEFAULTS.internalPort),
  /** Comma-separated browser origins allowed to connect. Empty = any (dev only). */
  ALLOWED_ORIGINS: z.string().default(''),
  /** Verifies tokens signed by host apps (dispensary, shelter). Dev default outside production. */
  REALTIME_TOKEN_SECRET: optionalSecret('REALTIME_TOKEN_SECRET'),
  /** Authenticates services calling the internal port. Dev default outside production. */
  REALTIME_INTERNAL_SECRET: optionalSecret('REALTIME_INTERNAL_SECRET'),
});

export type RealtimeServerConfig = {
  host: string;
  wsPort: number;
  internalPort: number;
  allowedOrigins: string[];
  tokenSecret: string;
  internalSecret: string;
  production: boolean;
};

export function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RealtimeServerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid realtime configuration: ${details}`);
  }

  const data = parsed.data;
  const production = data.NODE_ENV === 'production';
  const allowedOrigins = parseOrigins(data.ALLOWED_ORIGINS);
  if (production) {
    const missing = ['ALLOWED_ORIGINS', 'REALTIME_TOKEN_SECRET', 'REALTIME_INTERNAL_SECRET'].filter(
      (key) => (key === 'ALLOWED_ORIGINS' ? allowedOrigins.length === 0 : !data[key as keyof typeof data]),
    );
    if (missing.length > 0) {
      throw new Error(`Invalid realtime configuration: ${missing.join(', ')} required in production`);
    }
  }

  return {
    host: data.HOST,
    wsPort: data.WS_PORT,
    internalPort: data.INTERNAL_PORT,
    allowedOrigins,
    tokenSecret: data.REALTIME_TOKEN_SECRET ?? REALTIME_DEV_DEFAULTS.tokenSecret,
    internalSecret: data.REALTIME_INTERNAL_SECRET ?? REALTIME_DEV_DEFAULTS.internalSecret,
    production,
  };
}
