export type AgendaActionResult<T = unknown> = {
  status: number;
  data?: T;
  error?: string | { field: string | number; message: string }[];
};

export function runAgendaAction<T = unknown>(
  actionResponse: AgendaActionResult<T>,
): T | undefined {
  const { data, status, error } = actionResponse;

  if (status === 404) {
    throw new Error(typeof error === 'string' ? error : 'Resource not found');
  }

  if (status === 403) {
    throw new Error(typeof error === 'string' ? error : 'Forbidden');
  }

  if (status === 422 && error && Array.isArray(error)) {
    const message = error.map((e) => e.message).join(', ') || 'Validation error';
    throw new Error(message);
  }

  if (status >= 400) {
    throw new Error(
      typeof error === 'string' ? error : 'An error occurred, please try again later.',
    );
  }

  return data;
}
