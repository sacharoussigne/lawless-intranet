import { createActionErrorParser, type ActionErrorResponse } from '@lawless-intranet/host-kit/action';
import { reportServerError } from '@/lib/logs/errorReporter';
import { zodErrorParser } from './services/zod';

export { handleAction } from '@lawless-intranet/host-kit/action';

/** Zod issues are keyed by their top-level field (forms use flat field names). */
export const parseActionError = createActionErrorParser(zodErrorParser);

/**
 * Action response for a caught error. Server errors (status >= 500) also go to
 * the app log (`/platform/logs`, see docs/APP-LOGS.md); 4xx are expected and not logged.
 */
export function actionErrorParser(error: unknown, defaultMessage?: string): ActionErrorResponse {
  const response = parseActionError(error, defaultMessage);
  reportServerError({ error, status: response.status, message: errorMessage(response) });
  return response;
}

export function errorMessage(response: ActionErrorResponse): string {
  return typeof response.error === 'string' ? response.error : 'Données invalides';
}
