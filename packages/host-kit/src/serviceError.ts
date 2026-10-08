import { ServiceClientError } from '@lawless-intranet/service-client';
import type { ActionErrorResponse } from './action';

/**
 * Error of a server action calling a service: the service status and message
 * when it answered, otherwise the app's generic parser.
 */
export function serviceActionError(
  error: unknown,
  fallback: string,
  parse: (error: unknown, fallback: string) => ActionErrorResponse,
): ActionErrorResponse {
  if (error instanceof ServiceClientError) {
    return { status: error.status, error: error.message };
  }
  return parse(error instanceof Error ? error : new Error(fallback), fallback);
}
