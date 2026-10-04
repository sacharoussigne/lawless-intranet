import { z } from 'zod';

const portSchema = z.coerce.number().int().min(0).max(65535);

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  HOST: z.string().default('0.0.0.0'),
  /** Public websocket port (routed by nginx-proxy in production). */
  WS_PORT: portSchema.default(3007),
  /** Internal HTTP port for services (/publish, /revoke). Never routed publicly. */
  INTERNAL_PORT: portSchema.default(3008),
  /** Comma-separated browser origins allowed to connect. Empty = any (dev only). */
  ALLOWED_ORIGINS: z.string().default(''),
  /** Verifies tokens signed by host apps (dispensary, shelter). */
  REALTIME_TOKEN_SECRET: z.string().min(16, 'REALTIME_TOKEN_SECRET must be at least 16 characters'),
  /** Authenticates services calling the internal port. */
  REALTIME_INTERNAL_SECRET: z.string().min(16, 'REALTIME_INTERNAL_SECRET must be at least 16 characters'),
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
  if (production && allowedOrigins.length === 0) {
    throw new Error('Invalid realtime configuration: ALLOWED_ORIGINS is required in production');
  }

  return {
    host: data.HOST,
    wsPort: data.WS_PORT,
    internalPort: data.INTERNAL_PORT,
    allowedOrigins,
    tokenSecret: data.REALTIME_TOKEN_SECRET,
    internalSecret: data.REALTIME_INTERNAL_SECRET,
    production,
  };
}
