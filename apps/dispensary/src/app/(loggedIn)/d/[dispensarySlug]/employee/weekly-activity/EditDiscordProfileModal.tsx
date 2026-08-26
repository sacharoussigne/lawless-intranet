'use client';

import { useEffect, useState } from 'react';
import { Button, NumberInput, Select, Stack, Text } from '@mantine/core';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/dispensaryDiscordProfile/constants';
import {
  useUpdateDiscordProfileMutation,
  type WeeklyActivityListItem,
} from './hooks/useWeeklyActivityQueries';

type EditDiscordProfileModalProps = {
  row: WeeklyActivityListItem | null;
  onClose: () => void;
};

export function EditDiscordProfileModal({ row, onClose }: EditDiscordProfileModalProps) {
  const updateMutation = useUpdateDiscordProfileMutation();
  const [role, setRole] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<number | string>('');

  useEffect(() => {
    if (!row) return;
    setRole(row.discordProfileRole);
    setAccountNumber(row.discordProfileAccountNumber ?? '');
  }, [row]);

  const submit = async () => {
    if (!row) return;
    const parsedAccount =
      accountNumber === '' || accountNumber === null
        ? null
        : typeof accountNumber === 'number'
          ? accountNumber
          : Number.parseInt(String(accountNumber).trim(), 10);

    await updateMutation.mutateAsync({
      discordUserId: row.discordUserId,
      role: role?.trim() ? role.trim() : null,
      accountNumber:
        parsedAccount != null && Number.isFinite(parsedAccount) && parsedAccount > 0
          ? parsedAccount
          : null,
      weekBounds: {
        periodStart: new Date(row.periodStart),
        periodEnd: new Date(row.periodEnd),
      },
    });
    onClose();
  };

  return (
    <AppModal
      opened={row != null}
      onClose={onClose}
      title="Profil Discord"
      size="md"
    >
      {row && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {row.resolvedDisplayName}
          </Text>
          <Select
            label="Grade"
            placeholder="Choisir un grade"
            data={PAYROLL_EMPLOYEE_ROLES.map((r) => ({ value: r, label: r }))}
            value={role}
            onChange={setRole}
            clearable
            searchable
          />
          <NumberInput
            label="N° de compte"
            placeholder="Ex. 6408"
            value={accountNumber}
            onChange={setAccountNumber}
            min={1}
            max={999999}
            allowDecimal={false}
            allowNegative={false}
            hideControls
          />
          <AppModalFooter>
            <Button variant="default" onClick={onClose}>
              Annuler
            </Button>
            <Button loading={updateMutation.isPending} onClick={() => void submit()}>
              Enregistrer
            </Button>
          </AppModalFooter>
        </Stack>
      )}
    </AppModal>
  );
}
