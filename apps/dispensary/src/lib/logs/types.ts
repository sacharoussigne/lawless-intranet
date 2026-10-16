import type { AppFeatureKey } from '@/lib/appSettingsShared';

/** Feature of a log line: a tenant feature, or an area outside the feature toggles. */
export type LogFeature =
  | AppFeatureKey
  | 'management'
  | 'settings'
  | 'account'
  | 'platform'
  | 'unknown';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';
export type LogKind = 'ACTION' | 'ERROR' | 'BOT_REQUEST';
export type LogSource = 'INTRANET' | 'DISCORD_BOT' | 'SYSTEM';

/** success: done; noop: nothing to do (already done); denied: 401/403; invalid: other 4xx; failure: 5xx or exception. */
export type LogOutcome = 'success' | 'noop' | 'denied' | 'invalid' | 'failure';

export type AppLogEntry = {
  level: LogLevel;
  kind: LogKind;
  feature: LogFeature;
  event: string;
  outcome?: LogOutcome;
  message: string;
  source: LogSource;
  dispensaryId?: string | null;
  userId?: string | null;
  discordUserId?: string | null;
  impersonatedById?: string | null;
  httpStatus?: number | null;
  durationMs?: number | null;
  path?: string | null;
  /** Id of the object the action touched, when known (see target.ts). */
  targetId?: string | null;
  context?: unknown;
  error?: unknown;
};

export function outcomeFromStatus(status: number): LogOutcome {
  if (status >= 500) return 'failure';
  if (status === 401 || status === 403) return 'denied';
  if (status >= 400) return 'invalid';
  return 'success';
}

export function levelFromOutcome(outcome: LogOutcome): LogLevel {
  if (outcome === 'failure') return 'ERROR';
  if (outcome === 'denied' || outcome === 'invalid') return 'WARN';
  return 'INFO';
}
