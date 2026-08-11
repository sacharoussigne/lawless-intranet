import { ZodError } from 'zod/v3';

export function actionErrorParser(
  error: ZodError | Error | unknown,
  defaultMessage: string = 'Please try again.',
) {
  if (error instanceof ZodError) {
    return {
      status: 422,
      error: error.issues.map((issue) => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      })),
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      error: error.message,
    };
  }

  return {
    status: 500,
    error: defaultMessage,
  };
}

export function handleAction<T = unknown>(actionResponse: {
  data?: T;
  status: number;
  error?:
    | string
    | {
        field: string | number;
        message: string;
      }[];
}) {
  const { data, status, error } = actionResponse;
  if (status === 404) {
    throw new Error(typeof error === 'string' ? error : 'Resource not found');
  }

  if (status === 403) {
    throw new Error(typeof error === 'string' ? error : 'Forbidden');
  }

  if (status === 422 && error && Array.isArray(error)) {
    throw new Error(error.map((e) => e.message).join(', '));
  }
  if (status >= 400) {
    throw new Error(typeof error === 'string' ? error : 'An error occurred, please try again later.');
  }

  return data;
}
