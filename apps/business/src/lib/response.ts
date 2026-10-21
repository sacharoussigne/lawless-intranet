import type { ServerActionResponse } from '@/types/api';
import { NotFoundError } from './errors/NoFoundError';
import { ForbiddenError } from './errors/ForbiddenError';
import { NextResponse } from 'next/server';

/**
 * Checks if a Server Action response is successful
 */
export function isSuccessResponse<T>(
  response: ServerActionResponse<T>
): response is { status: 200; data: T } {
  return response.status === 200 && 'data' in response;
}

/**
 * Checks if a Server Action response is an error
 */
export function isErrorResponse(
  response: ServerActionResponse<unknown>
): response is Exclude<ServerActionResponse<unknown>, { status: 200; data: unknown }> {
  return response.status >= 400;
}

/**
 * Throws an error if the Server Action response is an error
 * Used in Server Components to handle errors
 */
export function throwIfError<T>(response: ServerActionResponse<T>, defaultMessage?: string): asserts response is { status: 200; data: T } {
  if (isErrorResponse(response)) {
    const errorMessage = typeof response.error === 'string' 
      ? response.error 
      : defaultMessage || 'Une erreur est survenue';
    
    // Use appropriate error classes for better error handling
    if (response.status === 404) {
      throw new NotFoundError(errorMessage);
    } else if (response.status === 403) {
      throw new ForbiddenError(errorMessage);
    } else if (response.status === 401) {
      const error = new Error(errorMessage);
      error.name = 'UnauthorizedError';
      throw error;
    }
    
    // For other errors, throw a standard Error
    throw new Error(errorMessage);
  }
}

export { getDataOrThrow } from '@lawless-intranet/host-kit/action';

/**
 * Returns a NextResponse for a 401 (Unauthorized) error
 * Used in middlewares
 */
export function unauthorizedResponse(data: { error: string }): NextResponse {
  return NextResponse.json(data, { status: 401 });
}

/**
 * Returns a NextResponse for a 403 (Forbidden) error
 * Used in middlewares
 */
export function forbiddenResponse(data: { error: string }): NextResponse {
  return NextResponse.json(data, { status: 403 });
}
