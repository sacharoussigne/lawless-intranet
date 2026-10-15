/**
 * Bridge between the shared error parsers (`@/lib/action`, also bundled for the
 * browser) and the server-side logger. `instrumentation.ts` registers the
 * reporter at server start; in the browser nothing is registered, so reporting
 * is a no-op and no server code reaches the client bundle.
 */
export type ServerErrorReport = {
  error: unknown;
  status: number;
  message: string;
  feature?: string;
  dispensaryId?: string;
};

type Reporter = (report: ServerErrorReport) => void;

const REPORTER_KEY = '__lawlessServerErrorReporter';

export function registerServerErrorReporter(reporter: Reporter): void {
  (globalThis as Record<string, unknown>)[REPORTER_KEY] = reporter;
}

/** Reports a server error (status >= 500) to the logger, if one is registered. Never throws. */
export function reportServerError(report: ServerErrorReport): void {
  if (report.status < 500 || typeof window !== 'undefined') return;
  const reporter = (globalThis as Record<string, unknown>)[REPORTER_KEY];
  if (typeof reporter !== 'function') return;
  try {
    (reporter as Reporter)(report);
  } catch {
    // Logging must never break the action.
  }
}
