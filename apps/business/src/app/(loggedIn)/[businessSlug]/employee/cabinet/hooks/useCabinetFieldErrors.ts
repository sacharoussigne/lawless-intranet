'use client';

import { useCallback, useState } from 'react';
import {
  clearCabinetFieldError,
  extractCabinetFieldErrors,
  extractCabinetFormError,
  hasCabinetFormErrors,
  CABINET_FORM_ERROR_BANNER_ID,
  type CabinetFieldErrors,
} from '@/lib/cabinet/formErrors';

export function useCabinetFieldErrors() {
  const [fieldErrors, setFieldErrors] = useState<CabinetFieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => clearCabinetFieldError(prev, field));
  }, []);

  const resetErrors = useCallback(() => {
    setFieldErrors({});
    setFormError(undefined);
  }, []);

  const applySubmitError = useCallback((error: unknown) => {
    const nextFieldErrors = extractCabinetFieldErrors(error);
    const nextFormError = extractCabinetFormError(error);
    setFieldErrors(nextFieldErrors);
    setFormError(nextFormError);

    if (hasCabinetFormErrors(nextFieldErrors, nextFormError)) {
      requestAnimationFrame(() => {
        document
          .getElementById(CABINET_FORM_ERROR_BANNER_ID)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  return {
    fieldErrors,
    formError,
    clearFieldError,
    resetErrors,
    applySubmitError,
  };
}
