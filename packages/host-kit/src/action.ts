import { ZodError } from 'zod/v3';
import {
  ErrorWithStatus,
  ForbiddenError,
  NotFoundError,
  ParsedZodError,
  type FieldError,
} from './errors';

export type { FieldError };

/** Shape returned by every server action of the host apps. */
export type ActionResponse<T> =
  | { status: number; data: T; error?: undefined }
  | { status: number; error: string | FieldError[]; data?: undefined }
  | { status: number; error?: undefined; data?: undefined };

export type ActionErrorResponse = { status: number; error: string | FieldError[] };

/**
 * Builds the app's `actionErrorParser`. The app picks how Zod issues map to
 * form fields (dispensary uses the top-level key, shelter the dotted path).
 */
export function createActionErrorParser(formatZodError: (error: ZodError) => FieldError[]) {
  return function actionErrorParser(
    error: unknown,
    defaultMessage: string = 'Please try again.',
  ): ActionErrorResponse {
    if (error instanceof ZodError) {
      return { status: 422, error: formatZodError(error) };
    }
    if (error instanceof ErrorWithStatus) {
      return { status: error.statusCode, error: error.message };
    }
    if (error instanceof Error) {
      return { status: 500, error: error.message };
    }
    return { status: 500, error: defaultMessage };
  };
}

/** Client side: unwraps an action response, throws a typed error on failure. */
export function handleAction<T = unknown>(actionResponse: {
  data?: T;
  status: number;
  error?: string | FieldError[];
}) {
  const { data, status, error } = actionResponse;
  if (status === 404) {
    throw new NotFoundError(typeof error === 'string' ? error : 'Resource not found');
  }
  if (status === 403) {
    throw new ForbiddenError(typeof error === 'string' ? error : 'Forbidden');
  }
  if (status === 422 && Array.isArray(error)) {
    throw new ParsedZodError(error);
  }
  if (status >= 400) {
    throw new Error(
      typeof error === 'string' ? error : 'An error occurred, please try again later.',
    );
  }
  return data;
}

/** Server Components: returns the data of an action response or throws (error boundary). */
export function getDataOrThrow<T>(
  response: { status: number; data?: T; error?: string | FieldError[] },
  defaultMessage?: string,
): T {
  if (response.status >= 400) {
    const errorMessage =
      typeof response.error === 'string' ? response.error : defaultMessage || 'Une erreur est survenue';

    if (response.status === 404) {
      throw new NotFoundError(errorMessage);
    }
    if (response.status === 403) {
      throw new ForbiddenError(errorMessage);
    }
    if (response.status === 401) {
      const error = new Error(errorMessage);
      error.name = 'UnauthorizedError';
      throw error;
    }
    throw new Error(errorMessage);
  }

  if (response.data === undefined || response.data === null) {
    throw new Error(defaultMessage || 'Aucune donnée disponible');
  }
  return response.data;
}

/** Result contract of the `*-ui` packages: data, or a single error message. */
export type UiActionResult<T> =
  | { status: number; data: T; error?: undefined }
  | { status: number; error: string; data?: undefined };

/** Maps a server action response to the `*-ui` result contract (field errors are joined). */
export async function toUiResult<T>(promise: Promise<ActionResponse<T>>): Promise<UiActionResult<T>> {
  const result = await promise;
  if (result.data !== undefined) {
    return { status: result.status, data: result.data };
  }
  const { error } = result;
  const message =
    typeof error === 'string'
      ? error
      : Array.isArray(error)
        ? error.map((e) => e.message).join(', ')
        : 'Erreur';
  return { status: result.status ?? 500, error: message };
}
