'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  cancelStaffEvent,
  changeStaffRole,
  endStaffEmployment,
  hireStaffMember,
  updateStaffEvent,
} from '@/app/_actions/staffRegister';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { ParsedZodError } from '@/lib/errors/ParsedZodError';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { peopleKeys } from '@/lib/people/queryKeys';
import type { PayrollEmployeeRole } from '@/lib/businessDiscordProfile/constants';
import type { Employment, EmploymentEndReason } from '@/lib/staff/types';

export function useStaffHistory(discordUserId: string) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: peopleKeys.staffHistory(businessSlug, discordUserId),
    queryFn: async () =>
      handleAction(await fetchRead(businessSlug, 'staffHistory', { discordUserId })) as Employment[],
    enabled: Boolean(businessSlug && discordUserId),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

function notifyError(error: Error) {
  if (error instanceof ParsedZodError) return;
  notifications.show({
    title: 'Erreur',
    message: error.message || 'Erreur lors de la sauvegarde',
    color: 'danger',
  });
}

/** Every register change moves the status in the list, the grade and the history. */
type StaffActionResult = Parameters<typeof handleAction>[0];

function useStaffMutation<V>(
  run: (businessSlug: string, vars: V) => Promise<StaffActionResult>,
  successTitle: string,
) {
  const businessSlug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: V) => handleAction(await run(businessSlug, vars)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: peopleKeys.all(businessSlug) });
      notifications.show({ title: successTitle, message: '', color: 'moss' });
    },
    onError: notifyError,
  });
}

export function useHireMutation() {
  return useStaffMutation(
    (slug, vars: { discordUserId: string; role: PayrollEmployeeRole | null; startedAt: Date; note?: string | null }) =>
      hireStaffMember(slug, vars),
    'Embauche enregistrée',
  );
}

export function useChangeRoleMutation() {
  return useStaffMutation(
    (slug, vars: { discordUserId: string; role: PayrollEmployeeRole | null; occurredAt: Date; note?: string | null }) =>
      changeStaffRole(slug, vars),
    'Grade modifié',
  );
}

export function useEndEmploymentMutation() {
  return useStaffMutation(
    (
      slug,
      vars: { discordUserId: string; endedAt: Date; endReason: EmploymentEndReason; note?: string | null },
    ) => endStaffEmployment(slug, vars),
    'Départ enregistré',
  );
}

export function useUpdateStaffEventMutation() {
  return useStaffMutation(
    (slug, vars: { eventId: string; occurredAt: Date; note?: string | null; endReason?: EmploymentEndReason }) =>
      updateStaffEvent(slug, vars),
    'Événement modifié',
  );
}

export function useCancelStaffEventMutation() {
  return useStaffMutation((slug, vars: { eventId: string }) => cancelStaffEvent(slug, vars), 'Événement annulé');
}
