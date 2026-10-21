'use client';

import type { ReactNode } from 'react';
import { Stack, TextInput } from '@mantine/core';
import type { FormEntityType } from '@/lib/cabinet/formSchema';

type CabinetFormSystemFieldsPreviewProps = {
  entityType: FormEntityType;
};

export function CabinetFormSystemFieldsPreview({
  entityType,
}: CabinetFormSystemFieldsPreviewProps) {
  if (entityType === 'patient') {
    return (
      <Stack gap="md">
        <TextInput label="Prénom" placeholder="—" disabled />
        <TextInput label="Nom" placeholder="—" disabled />
        <TextInput label="Date de naissance" placeholder="—" disabled />
        <TextInput label="Personne à contacter en cas d'urgence" placeholder="—" disabled />
      </Stack>
    );
  }

  if (entityType === 'careEpisode') {
    return (
      <Stack gap="md">
        <TextInput label="Motif" placeholder="—" disabled />
        <TextInput label="Date de début" placeholder="—" disabled />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <TextInput label="Date" placeholder="—" disabled />
    </Stack>
  );
}

export function getSystemCardsPreview(entityType: FormEntityType): Record<string, ReactNode> {
  const preview = <CabinetFormSystemFieldsPreview entityType={entityType} />;

  if (entityType === 'patient') {
    return { patient_identity: preview };
  }
  if (entityType === 'careEpisode') {
    return { care_episode_general: preview };
  }
  return { consultation_general: preview };
}

export function getFormEntityTabLabel(entityType: FormEntityType): string {
  switch (entityType) {
    case 'patient':
      return 'Fiche patient';
    case 'careEpisode':
      return 'Prise en charge';
    case 'consultation':
      return 'Consultation';
  }
}
