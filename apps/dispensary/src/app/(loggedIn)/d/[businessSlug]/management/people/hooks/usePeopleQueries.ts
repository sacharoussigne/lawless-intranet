'use client';

import type { PayrollEmployeeRole } from '@/lib/businessDiscordProfile/constants';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import { createBusinessPerson, updateBusinessPerson } from '@/app/_actions/businessPeople';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { peopleKeys } from '@/lib/people/queryKeys';
import { weeklyActivityKeys } from '@/app/(loggedIn)/d/[businessSlug]/employee/(activity)/weekly-activity/hooks/useWeeklyActivityQueries';
import type { BusinessPeopleList, BusinessPerson } from '@/lib/people/types';

export function usePeople(initialData: BusinessPeopleList) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: peopleKeys.list(businessSlug),
    queryFn: async () =>
      handleAction(await fetchRead(businessSlug, 'businessPeople')) as BusinessPeopleList,
    initialData,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

/** A name, grade or account number change shows up in the weekly activity and payroll too. */
function useInvalidatePeople() {
  const businessSlug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: peopleKeys.all(businessSlug) });
    void queryClient.invalidateQueries({ queryKey: weeklyActivityKeys.all(businessSlug) });
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
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async (vars: PersonFormValues) =>
      handleAction(await createBusinessPerson(businessSlug, vars)) as BusinessPerson,
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
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidatePeople();

  return useMutation({
    mutationFn: async (vars: {
      discordUserId: string;
      fixedDisplayName?: string | null;
      accountNumber: number | null;
      role?: PayrollEmployeeRole | null;
    }) => handleAction(await updateBusinessPerson(businessSlug, vars)) as BusinessPerson,
    onSuccess: () => {
      invalidate();
      notifications.show({ title: 'Personne modifiée', message: '', color: 'moss' });
    },
    onError: notifyError,
  });
}
