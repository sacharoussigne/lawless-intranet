'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Anchor, Button, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { PAYROLL_EMPLOYEE_ROLES, toPayrollEmployeeRole } from '@/lib/dispensaryDiscordProfile/constants';
import { tenantRoutes } from '@/types/routes';
import {
  useUpdateDiscordProfileMutation,
  type WeeklyActivityListItem,
} from './hooks/useWeeklyActivityQueries';

type EditDiscordProfileModalProps = {
  row: WeeklyActivityListItem | null;
  onClose: () => void;
  /** Only doctors who can edit all activity may fix a name. */
  canEditAll: boolean;
};

export function EditDiscordProfileModal({ row, onClose, canEditAll }: EditDiscordProfileModalProps) {
  return (
    <AppModal opened={row != null} onClose={onClose} title="Profil Discord" size="md">
      {row && (
        <EditDiscordProfileForm key={row.id} row={row} onClose={onClose} canEditAll={canEditAll} />
      )}
    </AppModal>
  );
}

function parseAccountNumber(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function EditDiscordProfileForm({
  row,
  onClose,
  canEditAll,
}: {
  row: WeeklyActivityListItem;
  onClose: () => void;
  canEditAll: boolean;
}) {
  const dispensarySlug = useRequiredDispensarySlug();
  const updateMutation = useUpdateDiscordProfileMutation();
  const [name, setName] = useState(row.resolvedDisplayName);
  const [role, setRole] = useState<string | null>(row.discordProfileRole);
  const [accountNumber, setAccountNumber] = useState<number | string>(
    row.discordProfileAccountNumber ?? '',
  );

  const trimmedName = name.trim();

  const submit = async () => {
    await updateMutation.mutateAsync({
      discordUserId: row.discordUserId,
      // A changed name becomes the fixed name; an unchanged one is left as is.
      fixedDisplayName:
        canEditAll && trimmedName && trimmedName !== row.resolvedDisplayName ? trimmedName : undefined,
      // Unchanged grade not sent: an old grade outside the payroll list is kept.
      role: role === row.discordProfileRole ? undefined : toPayrollEmployeeRole(role),
      accountNumber: accountNumber === '' ? null : parseAccountNumber(accountNumber),
      weekBounds: {
        periodStart: new Date(row.periodStart),
        periodEnd: new Date(row.periodEnd),
      },
    });
    onClose();
  };

  return (
    <Stack gap="md">
      {canEditAll ? (
        <TextInput
          label="Nom"
          description="Un nom modifié ici est fixé : le bot ne l'écrase plus."
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          maxLength={200}
          error={trimmedName ? undefined : 'Le nom est requis'}
        />
      ) : (
        <Text size="sm" c="dimmed">
          {row.resolvedDisplayName}
        </Text>
      )}
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
      {canEditAll && (
        <Text size="xs" c="dimmed">
          Toutes les personnes, avec ou sans compte :{' '}
          <Anchor component={Link} href={tenantRoutes(dispensarySlug).management.people} size="xs">
            Gestion › Personnes
          </Anchor>
        </Text>
      )}
      <AppModalFooter>
        <Button variant="default" onClick={onClose}>
          Annuler
        </Button>
        <Button
          loading={updateMutation.isPending}
          disabled={canEditAll && !trimmedName}
          onClick={() => void submit()}
        >
          Enregistrer
        </Button>
      </AppModalFooter>
    </Stack>
  );
}
