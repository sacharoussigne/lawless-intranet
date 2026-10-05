/**
 * Zero-config defaults for local development (everything on localhost).
 * Never used when NODE_ENV === 'production': production must set the
 * REALTIME_* variables explicitly and fails fast otherwise.
 */
export const REALTIME_DEV_DEFAULTS = {
  wsPort: 3007,
  internalPort: 3008,
  publicUrl: 'ws://localhost:3007',
  internalUrl: 'http://localhost:3008',
  tokenSecret: 'lawless-realtime-dev-token-secret',
  internalSecret: 'lawless-realtime-dev-internal-secret',
} as const;

export function isRealtimeProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

/** Explicit value, else the dev default outside production, else undefined. */
export function realtimeEnvOrDevDefault(
  value: string | undefined,
  devDefault: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (value) return value;
  return isRealtimeProduction(env) ? undefined : devDefault;
}
