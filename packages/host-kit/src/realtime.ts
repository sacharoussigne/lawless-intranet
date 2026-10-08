import { REALTIME_DEV_DEFAULTS, realtimeEnvOrDevDefault } from '@lawless-intranet/realtime';

/** Browser websocket URL; ws://localhost:3007 outside production. Empty disables realtime. */
export function getRealtimePublicUrl(): string {
  return realtimeEnvOrDevDefault(process.env.REALTIME_PUBLIC_URL, REALTIME_DEV_DEFAULTS.publicUrl) ?? '';
}

/** Secret used to sign realtime tokens; dev secret outside production. */
export function getRealtimeTokenSecret(): string | undefined {
  return realtimeEnvOrDevDefault(process.env.REALTIME_TOKEN_SECRET, REALTIME_DEV_DEFAULTS.tokenSecret);
}
