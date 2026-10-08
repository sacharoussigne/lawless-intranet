export type MediaActionResult<T = unknown> = {
  status: number;
  data?: T;
  error?: string | { field: string | number; message: string }[];
};

/** Unwraps a host server action result; throws on errors (for React Query). */
export function runMediaAction<T>(result: MediaActionResult<T>): T {
  const { status, data, error } = result;
  if (status >= 400) {
    if (Array.isArray(error)) {
      throw new Error(error.map((issue) => issue.message).join(', ') || 'Données invalides');
    }
    throw new Error(typeof error === 'string' ? error : 'Une erreur est survenue');
  }
  return data as T;
}
