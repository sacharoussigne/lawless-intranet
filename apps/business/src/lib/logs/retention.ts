import prisma from '@/lib/prisma';

/** Log lines older than this are deleted (docs/APP-LOGS.md). */
export const APP_LOG_RETENTION_DAYS = 90;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function appLogRetentionCutoff(now: Date, days = APP_LOG_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export async function purgeOldAppLogs(now = new Date()): Promise<number> {
  const { count } = await prisma.appLog.deleteMany({
    where: { createdAt: { lt: appLogRetentionCutoff(now) } },
  });
  return count;
}

const globalForRetention = globalThis as unknown as { __appLogRetention?: NodeJS.Timeout };

/** Purges now and every day, once per process (dev reloads included). */
export function startAppLogRetention(): void {
  if (globalForRetention.__appLogRetention) return;

  const run = () => {
    purgeOldAppLogs()
      .then((count) => {
        if (count > 0) console.warn(`[app-log] purged ${count} log line(s) older than ${APP_LOG_RETENTION_DAYS} days`);
      })
      .catch((error: unknown) => {
        console.error('[app-log] retention purge failed', error);
      });
  };

  run();
  const timer = setInterval(run, RETENTION_INTERVAL_MS);
  timer.unref();
  globalForRetention.__appLogRetention = timer;
}
