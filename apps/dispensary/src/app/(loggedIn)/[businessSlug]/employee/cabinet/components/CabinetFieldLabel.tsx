'use client';

import { Text } from '@mantine/core';
import type { CabinetLabelColorKey } from '@/lib/cabinet/displaySettings';
import { resolveLabelColor } from '@/lib/cabinet/displaySettings';
import { useCabinetDisplaySettings } from './CabinetDisplaySettingsContext';

type CabinetFieldLabelProps = {
  labelKey: CabinetLabelColorKey;
  children: React.ReactNode;
  required?: boolean;
  fieldId?: string;
};

export function CabinetFieldLabel({
  labelKey,
  children,
  required = false,
  fieldId,
}: CabinetFieldLabelProps) {
  const settings = useCabinetDisplaySettings();
  const color = resolveLabelColor(labelKey, settings, fieldId);

  return (
    <Text size="sm" component="span" fw={700} style={{ color }}>
      {children}
      {required && ' *'} :
    </Text>
  );
}

type SystemFieldValueProps = {
  label: string;
  value: React.ReactNode;
};

export function SystemFieldValue({ label, value }: SystemFieldValueProps) {
  return (
    <Text size="sm" component="div">
      <CabinetFieldLabel labelKey="system">{label}</CabinetFieldLabel>{' '}
      {value ?? '—'}
    </Text>
  );
}
