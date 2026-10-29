'use client';

import { useMemo, useState } from 'react';
import { Button, NumberInput, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/businessDiscordProfile/constants';
import { isCashPreparerGrade } from '@/lib/businessTypes';
import { payrollNameKey } from '@/lib/payroll/mergeWeeklyActivity';
import type { PayrollReportResult } from '@/lib/payroll/schema';
import { usePayrollPeople } from '../hooks/usePayrollQueries';

type Mode = 'registered' | 'free';

type AddPayrollEmployeeModalProps = {
  opened: boolean;
  onClose: () => void;
  employees: PayrollReportResult['employees'];
  /** « Préparateurs de caisse » report: only offer the préparateurs; otherwise everyone else. */
  forCashPreparers?: boolean;
  onAdd: (identity: { name: string; role: string; id: number | null }) => void;
};

const ROLE_OPTIONS = PAYROLL_EMPLOYEE_ROLES.map((r) => ({ value: r, label: r }));

/**
 * Adds someone to a report: a person of the dispensary (name, grade and account
 * number prefilled) or anyone typed by hand. The account number only applies to
 * this report.
 */
export function AddPayrollEmployeeModal({
  opened,
  onClose,
  employees,
  forCashPreparers = false,
  onAdd,
}: AddPayrollEmployeeModalProps) {
  const { data: people = [], isLoading } = usePayrollPeople(opened);
  const { appSettings } = usePermissions();
  const [mode, setMode] = useState<Mode>('registered');
  const [personId, setPersonId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<number | ''>('');

  // People already in the report (same account number or same name) cannot be added twice.
  const personOptions = useMemo(() => {
    const names = new Set(employees.map((e) => payrollNameKey(e.name)));
    const accounts = new Set(employees.map((e) => e.id).filter((id): id is number => id != null));
    return people
      .filter((p) => isCashPreparerGrade(appSettings.businessType, p.role) === forCashPreparers)
      .map((p) => {
      const inReport =
        names.has(payrollNameKey(p.name)) ||
        (p.accountNumber != null && accounts.has(p.accountNumber));
      return {
        value: p.discordUserId,
        label: inReport ? `${p.name} (déjà dans le rapport)` : p.name,
        disabled: inReport,
      };
    });
  }, [people, employees, forCashPreparers, appSettings.businessType]);

  const reset = () => {
    setMode('registered');
    setPersonId(null);
    setName('');
    setRole(null);
    setAccountNumber('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickPerson = (id: string | null) => {
    setPersonId(id);
    const person = people.find((p) => p.discordUserId === id);
    setName(person?.name ?? '');
    setRole(person?.role ?? null);
    setAccountNumber(person?.accountNumber ?? '');
  };

  const canAdd = name.trim().length > 0 && (mode === 'free' || personId !== null);

  const submit = () => {
    if (!canAdd) return;
    onAdd({
      name: name.trim(),
      role: role ?? '',
      id: accountNumber === '' ? null : accountNumber,
    });
    close();
  };

  return (
    <AppModal
      opened={opened}
      onClose={close}
      title="Ajouter une personne"
      description="Les jours et les compteurs se remplissent ensuite dans sa fiche du rapport."
      icon={IconUserPlus}
      size="md"
    >
      <Stack gap="md">
        <SegmentedControl
          color="sage"
          value={mode}
          onChange={(v) => {
            setMode(v as Mode);
            pickPerson(null);
          }}
          data={[
            { value: 'registered', label: 'Personne enregistrée' },
            { value: 'free', label: 'Saisie libre' },
          ]}
        />

        {mode === 'registered' && (
          <Select
            label="Personne"
            data-autofocus
            placeholder={isLoading ? 'Chargement…' : 'Rechercher une personne'}
            data={personOptions}
            value={personId}
            onChange={pickPerson}
            searchable
            nothingFoundMessage="Aucune personne (Gestion › Personnes)"
            comboboxProps={{ zIndex: 450 }}
          />
        )}

        {(mode === 'free' || personId) && (
          <>
            <TextInput
              label="Nom"
              data-autofocus
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              maxLength={200}
            />
            <Select
              label="Grade"
              placeholder="Choisir un grade"
              data={ROLE_OPTIONS}
              value={role}
              onChange={setRole}
              clearable
              searchable
              comboboxProps={{ zIndex: 450 }}
            />
            <NumberInput
              label="N° de compte"
              description="Pour les virements de ce rapport uniquement."
              placeholder="Inconnu"
              min={1}
              max={999999}
              allowDecimal={false}
              allowNegative={false}
              hideControls
              value={accountNumber}
              onChange={(v) => setAccountNumber(typeof v === 'number' ? v : '')}
            />
          </>
        )}

        {mode === 'registered' && !isLoading && people.length === 0 && (
          <Text size="sm" c="dimmed">
            Aucune personne enregistrée : utilisez la saisie libre.
          </Text>
        )}

        <AppModalFooter>
          <Button variant="default" onClick={close}>
            Annuler
          </Button>
          <Button color="sage" onClick={submit} disabled={!canAdd}>
            Ajouter
          </Button>
        </AppModalFooter>
      </Stack>
    </AppModal>
  );
}
