'use client';

import { Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import {
  countCabinetFieldErrors,
  hasCabinetFormErrors,
  CABINET_FORM_ERROR_BANNER_ID,
  type CabinetFieldErrors,
} from '@/lib/cabinet/formErrors';

type CabinetFormErrorBannerProps = {
  fieldErrors?: CabinetFieldErrors;
  formError?: string;
};

function buildSummaryMessage(fieldErrors: CabinetFieldErrors, formError?: string): string {
  const fieldCount = countCabinetFieldErrors(fieldErrors);

  if (formError && fieldCount > 0) {
    const fieldsHint =
      fieldCount === 1
        ? 'Un champ est également signalé plus bas.'
        : `${fieldCount} champs sont également signalés plus bas.`;
    return `${formError} ${fieldsHint}`;
  }

  if (formError) return formError;

  if (fieldCount === 1) {
    return 'Un champ contient une erreur. Faites défiler le formulaire pour le corriger.';
  }

  return `${fieldCount} champs contiennent des erreurs. Faites défiler le formulaire pour les corriger.`;
}

export function CabinetFormErrorBanner({
  fieldErrors = {},
  formError,
}: CabinetFormErrorBannerProps) {
  if (!hasCabinetFormErrors(fieldErrors, formError)) return null;

  return (
    <Alert
      id={CABINET_FORM_ERROR_BANNER_ID}
      icon={<IconAlertCircle size={18} />}
      title="Impossible d'enregistrer"
      color="danger"
      variant="light"
      role="alert"
    >
      {buildSummaryMessage(fieldErrors, formError)}
    </Alert>
  );
}
