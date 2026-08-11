import { NotFoundError } from '@/lib/errors/NoFoundError';
import { ForbiddenError } from '@/lib/errors/ForbiddenError';

export function getDataOrThrow<T>(
  response: { status: number; data?: T; error?: string | Array<{ field: string | number; message: string }> },
  defaultMessage?: string,
): T {
  if (response.status >= 400) {
    const errorMessage =
      typeof response.error === 'string'
        ? response.error
        : defaultMessage || 'Une erreur est survenue';

    if (response.status === 404) {
      throw new NotFoundError(errorMessage);
    } else if (response.status === 403) {
      throw new ForbiddenError(errorMessage);
    } else if (response.status === 401) {
      const error = new Error(errorMessage);
      error.name = 'UnauthorizedError';
      throw error;
    }

    throw new Error(errorMessage);
  }

  if (!('data' in response) || response.data === undefined) {
    throw new Error(defaultMessage || 'Aucune donnée disponible');
  }

  return response.data;
}
