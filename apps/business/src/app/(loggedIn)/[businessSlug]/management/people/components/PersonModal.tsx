'use client';

import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { Button, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { PAYROLL_EMPLOYEE_ROLES, toPayrollEmployeeRole } from '@/lib/businessDiscordProfile/constants';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { handleApiZodError } from '@/lib/services/zod';
import type { BusinessPerson, MemberWithoutProfile, SalaryTypeOption } from '@/lib/people/types';
import { useCreatePersonMutation, useUpdatePersonMutation } from '../hooks/usePeopleQueries';

type PersonModalProps = {
  opened: boolean;
  /** `null`: add a person. */
  person: BusinessPerson | null;
  membersWithoutProfile: MemberWithoutProfile[];
  /** `null`: payroll module off, no salary field. */
  salaryTypes: SalaryTypeOption[] | null;
  onClose: () => void;
};

export function PersonModal({ opened, person, membersWithoutProfile, salaryTypes, onClose }: PersonModalProps) {
  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={person ? 'Modifier la personne' : 'Ajouter une personne'}
      size="md"
    >
      {opened && (
        <PersonForm
          key={person?.discordUserId ?? 'new'}
          person={person}
          membersWithoutProfile={membersWithoutProfile}
          salaryTypes={salaryTypes}
          onClose={onClose}
        />
      )}
    </AppModal>
  );
}

type FormValues = {
  discordUserId: string;
  displayName: string;
  accountNumber: number | string;
  role: string | null;
  /** `null`: the business default. */
  salaryTypeId: string | null;
};

function toAccountNumber(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function salaryTypeLabel(salaryType: SalaryTypeOption): string {
  return `${salaryType.label} · ${salaryType.caisseUnitUsd.toFixed(2)} $ par caisse`;
}

function PersonForm({
  person,
  membersWithoutProfile,
  salaryTypes,
  onClose,
}: {
  person: BusinessPerson | null;
  membersWithoutProfile: MemberWithoutProfile[];
  salaryTypes: SalaryTypeOption[] | null;
  onClose: () => void;
}) {
  const defaultSalaryType = salaryTypes?.find((s) => s.isDefault);
  const createMutation = useCreatePersonMutation();
  const updateMutation = useUpdatePersonMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormValues>({
    initialValues: {
      discordUserId: person?.discordUserId ?? '',
      displayName: person ? (person.fixedDisplayName ?? person.displayName) : '',
      accountNumber: person?.accountNumber ?? '',
      role: person?.role ?? null,
      salaryTypeId: person?.salaryType?.id ?? null,
    },
    validate: {
      discordUserId: (value) =>
        /^\d{17,20}$/.test(value.trim()) ? null : 'Discord ID invalide (17 à 20 chiffres)',
      displayName: (value) => (value.trim() ? null : 'Le nom est requis'),
    },
  });

  const run = async (submit: () => Promise<unknown>) => {
    try {
      await submit();
      onClose();
    } catch (error: unknown) {
      if (error instanceof ParsedZodError) {
        handleApiZodError(error.error, form);
      }
    }
  };

  const handleSubmit = (values: FormValues) =>
    run(() => {
      const shared = {
        accountNumber: values.accountNumber === '' ? null : toAccountNumber(values.accountNumber),
        // Unchanged grade not sent: an old grade outside the payroll list is kept.
        role: values.role === (person?.role ?? null) ? undefined : toPayrollEmployeeRole(values.role),
        // Not sent without the payroll module, so the salary type is kept.
        salaryTypeId: salaryTypes ? values.salaryTypeId : undefined,
      };
      if (person) {
        const name = values.displayName.trim();
        return updateMutation.mutateAsync({
          discordUserId: person.discordUserId,
          // Changing only the grade or the number does not freeze the bot's name.
          fixedDisplayName: person.fixedDisplayName || name !== person.displayName ? name : undefined,
          ...shared,
        });
      }
      return createMutation.mutateAsync({
        discordUserId: values.discordUserId.trim(),
        displayName: values.displayName.trim(),
        ...shared,
      });
    });

  const removeFixedName = () =>
    person &&
    run(() =>
      updateMutation.mutateAsync({
        discordUserId: person.discordUserId,
        fixedDisplayName: null,
        accountNumber: person.accountNumber,
      }),
    );

  const pickMember = (userId: string | null) => {
    const member = membersWithoutProfile.find((m) => m.userId === userId);
    if (!member) return;
    form.setValues({ discordUserId: member.discordUserId, displayName: member.name });
  };

  return (
    <form {...noAutofillProps} onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="md">
        {!person && membersWithoutProfile.length > 0 && (
          <Select
            label="Membre avec Discord (optionnel)"
            description="Remplit le Discord ID et le nom à partir d'un compte intranet."
            placeholder="Choisir un membre"
            data={membersWithoutProfile.map((m) => ({ value: m.userId, label: m.name }))}
            onChange={pickMember}
            searchable
            clearable
          />
        )}
        <TextInput
          label="Discord ID"
          description={
            person
              ? undefined
              : 'Si la personne crée un compte plus tard avec ce Discord, il lui sera rattaché.'
          }
          placeholder="Ex. 284726189304512512"
          disabled={Boolean(person)}
          withAsterisk={!person}
          {...form.getInputProps('discordUserId')}
        />
        <TextInput
          label="Nom"
          description="Utilisé partout dans le dispensaire, à la place du pseudo envoyé par le bot."
          withAsterisk
          maxLength={200}
          {...form.getInputProps('displayName')}
        />
        {person?.fixedDisplayName && person.lastDisplayName && person.lastDisplayName !== person.fixedDisplayName && (
          <Text size="xs" c="dimmed">
            Dernier nom envoyé par le bot : {person.lastDisplayName}
          </Text>
        )}
        <NumberInput
          label="N° de compte"
          placeholder="Ex. 6408"
          min={1}
          max={999999}
          allowDecimal={false}
          allowNegative={false}
          hideControls
          {...form.getInputProps('accountNumber')}
        />
        <Select
          label="Grade"
          placeholder="Choisir un grade"
          data={PAYROLL_EMPLOYEE_ROLES.map((r) => ({ value: r, label: r }))}
          clearable
          searchable
          {...form.getInputProps('role')}
        />
        {salaryTypes && (
          <Select
            label="Salaire"
            description={
              salaryTypes.length === 0
                ? 'Aucun type de salaire : à créer dans Paramètres › Salaires.'
                : 'Montant reversé par caisse dans les rapports de paie.'
            }
            placeholder={
              defaultSalaryType ? `Par défaut (${salaryTypeLabel(defaultSalaryType)})` : 'Par défaut'
            }
            data={salaryTypes.map((s) => ({ value: s.id, label: salaryTypeLabel(s) }))}
            disabled={salaryTypes.length === 0}
            clearable
            {...form.getInputProps('salaryTypeId')}
          />
        )}
        {person?.account && (
          <Text size="xs" c="dimmed">
            Compte intranet lié : {person.account.name}
          </Text>
        )}
        <AppModalFooter>
          {person?.fixedDisplayName && (
            <Button variant="subtle" color="slate" onClick={() => void removeFixedName()} disabled={isPending}>
              Retirer le nom fixé
            </Button>
          )}
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" loading={isPending}>
            {person ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </AppModalFooter>
      </Stack>
    </form>
  );
}
