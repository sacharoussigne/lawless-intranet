import { ParsedZodError } from '@/lib/errors/ParsedZodError';

export type CabinetFieldErrors = Record<string, string>;

export const CABINET_FORM_ERROR_BANNER_ID = 'cabinet-form-error-banner';

export function extractCabinetFieldErrors(error: unknown): CabinetFieldErrors {
  if (!(error instanceof ParsedZodError)) return {};

  const { _form: _, ...fieldErrors } = error.toFormError();
  return fieldErrors;
}

export function extractCabinetFormError(error: unknown): string | undefined {
  if (error instanceof ParsedZodError) {
    return error.toFormError()._form;
  }
  if (error instanceof Error && error.message) return error.message;
  return undefined;
}

export function clearCabinetFieldError(
  errors: CabinetFieldErrors,
  field: string,
): CabinetFieldErrors {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

export function countCabinetFieldErrors(fieldErrors: CabinetFieldErrors): number {
  return Object.keys(fieldErrors).length;
}

export function hasCabinetFormErrors(
  fieldErrors: CabinetFieldErrors,
  formError?: string,
): boolean {
  return !!formError || countCabinetFieldErrors(fieldErrors) > 0;
}
