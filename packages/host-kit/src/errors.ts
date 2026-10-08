export type FieldError = { field: string | number; message: string };

/** Error carrying an HTTP-like status, mapped as-is by `actionErrorParser`. */
export class ErrorWithStatus extends Error {
  constructor(
    message: string,
    public statusCode = 500,
  ) {
    super(message);
  }
}

export class NotFoundError extends ErrorWithStatus {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends ErrorWithStatus {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/** Field errors of a 422 action response, thrown client-side by `handleAction`. */
export class ParsedZodError extends ErrorWithStatus {
  constructor(public error: FieldError[]) {
    const message =
      error
        .map((entry) => entry.message)
        .filter(Boolean)
        .join(' · ') || 'Données invalides';
    super(message, 422);
  }

  toFormError() {
    const error: { [key: string]: string } = {};
    for (const e of this.error) {
      error[e.field] = e.message;
    }
    return error;
  }
}
