'use client';

import type { PayrollEmployeeRole } from '@/lib/dispensaryDiscordProfile/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { createDispensaryPerson, updateDispensaryPerson } from '@/app/_actions/dispensaryPeople';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { peopleKeys } from '@/lib/people/queryKeys';
import { weeklyActivityKeys } from '@/app/(loggedIn)/d/[dispensarySlug]/employee/(activity)/weekly-activity/hooks/useWeeklyActivityQueries';
import type { DispensaryPeopleList, DispensaryPerson } from '@/lib/people/types';

export function usePeople(initialData: DispensaryPeopleList) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: peopleKeys.list(dispensarySlug),
    queryFn: async () =>
      handleAction(await fetchRead(dispensarySlug, 'dispensaryPeople')) as DispensaryPeopleList,
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/** A name, grade or account number change shows up in the weekly activity and payroll too. */
function useInvalidatePeople() {
  const dispensarySlug = useRequiredDispensarySlug();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: peopleKeys.all(dispensarySlug) });
    void queryClient.invalidateQueries({ queryKey: weeklyActivityKeys.all(dispensarySlug) });
  };
}

function notifyError(error: Error) {
  if (error instanceof ParsedZodError) return;
  notifications.show({
    title: 'Erreur',
    message: error.message || 'Erreur lors de la sauvegarde',
    color: 'danger',
  });
}

export type PersonFormValues = {
  discordUserId: string;
  displayName: string;
  accountNumber: number | null;
  role?: PayrollEmployeeRole | null;
};

export function useCreatePersonMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async (vars: PersonFormValues) =>
      handleAction(await createDispensaryPerson(dispensarySlug, vars)) as DispensaryPerson,
    onSuccess: (person) => {
      invalidate();
      notifications.show({
        title: 'Personne ajoutée',
        message: person.account
          ? `${person.displayName} est liée au compte ${person.account.name}.`
          : `${person.displayName} sera liée à son compte dès qu'elle en aura un.`,
        color: 'moss',
      });
    },
    onError: notifyError,
  });
}

export function useUpdatePersonMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async (vars: {
      discordUserId: string;
      fixedDisplayName?: string | null;
      accountNumber: number | null;
      role?: PayrollEmployeeRole | null;
    }) => handleAction(await updateDispensaryPerson(dispensarySlug, vars)) as DispensaryPerson,
    onSuccess: () => {
      invalidate();
      notifications.show({ title: 'Personne modifiée', message: '', color: 'moss' });
    },
    onError: notifyError,
  });
}
