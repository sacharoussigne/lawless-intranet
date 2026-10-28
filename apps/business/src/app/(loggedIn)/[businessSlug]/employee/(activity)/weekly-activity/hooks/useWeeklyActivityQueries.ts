'use client';

import type { PayrollEmployeeRole } from '@/lib/businessDiscordProfile/constants';
import { peopleKeys } from '@/lib/people/queryKeys';
import { useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import {
  createBusinessWeeklyActivity,
  deleteBusinessWeeklyActivity,
  incrementOwnWeeklyCounter,
  markOwnWeeklyChestToday,
  markOwnWeeklyPresenceToday,
  updateBusinessWeeklyActivity,
  updateBusinessDiscordProfile,
} from '@/app/_actions/businessWeeklyActivity';
import { fetchRead } from '@/lib/read/fetchRead';
import { handleAction } from '@/lib/action';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import {
  isSameWeeklyActivityWeek,
  normalizeWeeklyActivityWeekBounds,
  weeklyActivityWeekKey,
  type WeeklyActivityWeekBounds,
} from '@/lib/businessWeeklyActivity/queryKeys';
import type { SerializedBusinessWeeklyActivityRow } from '@/lib/businessWeeklyActivity/apiRow';
import type { SalaryEstimate } from '@/lib/payroll/botSalaryEstimate';
import type { WeekHoursRecapBundle, WeekHoursRecapDay } from '@/lib/businessWeeklyActivity/weekHoursRecap';
import {
  useOptionalRealtimeSocket,
  useRealtimeSocketResync,
} from '@lawless-intranet/realtime/socket';
import { weeklyActivityMutationMeta } from '@/lib/businessWeeklyActivity/realtime/client/mutationMeta';
import type { WeeklyActivityRealtimeEvent } from '@/lib/businessWeeklyActivity/realtime/types';

/** `salary`: estimated pay, on the viewer's own row only (null otherwise or without payroll). */
export type WeeklyActivityListItem = SerializedBusinessWeeklyActivityRow & { salary?: SalaryEstimate | null };

export type WeeklyActivityHistoryEntry = {
  id: string;
  action: string;
  source: string;
  actorUserName: string | null;
  actorResolvedName: string | null;
  actorImpersonatedByName?: string | null;
  actorDiscordUserId: string | null;
  createdAt: string;
  /** Counter of INCREMENT_/DECREMENT_COUNTER. */
  counterKey?: string | null;
  previousValues: unknown;
  nextValues: unknown;
};

/** A person a row can be created for (`id` = Discord id), with or without an account. */
export type WeeklyActivityTargetUser = {
  id: string;
  name: string | null;
  discordDisplayName: string;
  hasAccount: boolean;
};

export type WeeklyHoursRecapDayDto = WeekHoursRecapDay;
export type WeeklyHoursRecapBundleDto = WeekHoursRecapBundle;

export const weeklyActivityKeys = {
  all: (slug: string) => ['weeklyActivity', slug] as const,
  list: (slug: string, weekKey: string) =>
    [...weeklyActivityKeys.all(slug), 'list', weekKey] as const,
  history: (slug: string, activityId: string) =>
    [...weeklyActivityKeys.all(slug), 'history', activityId] as const,
  targets: (slug: string) => [...weeklyActivityKeys.all(slug), 'targets'] as const,
  hoursRecap: (slug: string, weekKey: string, discordUserId: string | null) =>
    [...weeklyActivityKeys.all(slug), 'hoursRecap', weekKey, discordUserId ?? 'all'] as const,
};

async function fetchWeeklyActivities(
  businessSlug: string,
  bounds: WeeklyActivityWeekBounds,
): Promise<WeeklyActivityListItem[]> {
  const normalized = normalizeWeeklyActivityWeekBounds(bounds);
  const result = await fetchRead(businessSlug, 'weeklyActivities', normalized);
  const data = handleAction(result);
  return Array.isArray(data) ? data : [];
}

async function fetchWeeklyActivityHistory(
  businessSlug: string,
  activityId: string,
): Promise<WeeklyActivityHistoryEntry[]> {
  const result = await fetchRead(businessSlug, 'weeklyActivityHistory', { id: activityId });
  const data = handleAction(result);
  return Array.isArray(data) ? data : [];
}

async function fetchWeeklyHoursRecap(
  businessSlug: string,
  periodStart: Date,
  discordUserId: string | null,
): Promise<WeeklyHoursRecapBundleDto> {
  const result = await fetchRead(businessSlug, 'weeklyHoursRecap', {
    periodStart,
    discordUserId,
  });
  const data = handleAction(result) as WeeklyHoursRecapBundleDto | undefined;
  return data ?? { days: [], doctors: [] };
}

async function fetchWeeklyActivityTargets(
  businessSlug: string,
): Promise<WeeklyActivityTargetUser[]> {
  const result = await fetchRead(businessSlug, 'weeklyActivityTargets');
  const data = handleAction(result) as { users?: WeeklyActivityTargetUser[] } | undefined;
  return data?.users ?? [];
}

function useWeeklyActivityMutationMeta() {
  const clientId = useOptionalRealtimeSocket()?.clientId;
  return weeklyActivityMutationMeta(clientId);
}

/** Refetches every weekly activity query after a websocket reconnect (changes missed meanwhile). */
export function useWeeklyActivityRealtimeResync() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();
  const resync = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: weeklyActivityKeys.all(businessSlug) });
  }, [businessSlug, queryClient]);
  useRealtimeSocketResync(resync);
}

export function invalidateWeeklyActivityFromRealtimeEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  businessSlug: string,
  event: WeeklyActivityRealtimeEvent,
  options?: {
    visibleWeekBounds?: WeeklyActivityWeekBounds | null;
    openHistoryActivityId?: string | null;
  },
) {
  const eventBounds = normalizeWeeklyActivityWeekBounds({
    periodStart: new Date(event.periodStart),
    periodEnd: new Date(event.periodEnd),
  });

  if (
    options?.visibleWeekBounds &&
    isSameWeeklyActivityWeek(options.visibleWeekBounds, eventBounds)
  ) {
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.list(
        businessSlug,
        weeklyActivityWeekKey(options.visibleWeekBounds),
      ),
    });
  } else if (!options?.visibleWeekBounds) {
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.all(businessSlug),
    });
  }

  if (options?.openHistoryActivityId && options.openHistoryActivityId === event.activityId) {
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.history(businessSlug, event.activityId),
    });
  }
}

export function useWeeklyActivities(
  weekBounds: WeeklyActivityWeekBounds | null,
  initialData?: {
    bounds: WeeklyActivityWeekBounds;
    rows: WeeklyActivityListItem[];
  },
) {
  const businessSlug = useRequiredBusinessSlug();
  const weekKey = weekBounds ? weeklyActivityWeekKey(weekBounds) : '';

  return useQuery({
    queryKey: weeklyActivityKeys.list(businessSlug, weekKey),
    queryFn: () => {
      if (!weekBounds) throw new Error('weekBounds is required');
      return fetchWeeklyActivities(businessSlug, weekBounds);
    },
    initialData:
      initialData &&
      weekBounds &&
      isSameWeeklyActivityWeek(initialData.bounds, weekBounds)
        ? initialData.rows
        : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(businessSlug && weekBounds),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useWeeklyActivityHistory(activityId: string | null, enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: weeklyActivityKeys.history(businessSlug, activityId ?? ''),
    queryFn: () => {
      if (!activityId) throw new Error('activityId is required');
      return fetchWeeklyActivityHistory(businessSlug, activityId);
    },
    enabled: Boolean(activityId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useWeeklyHoursRecap(
  weekBounds: WeeklyActivityWeekBounds | null,
  discordUserId: string | null,
  enabled: boolean,
) {
  const businessSlug = useRequiredBusinessSlug();
  const weekKey = weekBounds ? weeklyActivityWeekKey(weekBounds) : '';

  return useQuery({
    queryKey: weeklyActivityKeys.hoursRecap(businessSlug, weekKey, discordUserId),
    queryFn: () => {
      if (!weekBounds) throw new Error('weekBounds is required');
      const { periodStart } = normalizeWeeklyActivityWeekBounds(weekBounds);
      return fetchWeeklyHoursRecap(businessSlug, periodStart, discordUserId);
    },
    enabled: Boolean(businessSlug && weekBounds && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useWeeklyActivityTargets(enabled: boolean) {
  const businessSlug = useRequiredBusinessSlug();

  return useQuery({
    queryKey: weeklyActivityKeys.targets(businessSlug),
    queryFn: () => fetchWeeklyActivityTargets(businessSlug),
    enabled: Boolean(businessSlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useInvalidateWeeklyActivities() {
  const queryClient = useQueryClient();
  const businessSlug = useRequiredBusinessSlug();

  return (bounds?: WeeklyActivityWeekBounds) => {
    if (bounds) {
      void queryClient.invalidateQueries({
        queryKey: weeklyActivityKeys.list(
          businessSlug,
          weeklyActivityWeekKey(bounds),
        ),
      });
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.all(businessSlug),
    });
  };
}

export function useCreateWeeklyActivityMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: {
      payload: Parameters<typeof createBusinessWeeklyActivity>[1];
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await createBusinessWeeklyActivity(businessSlug, vars.payload, meta);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ weekBounds }) => {
      invalidate(weekBounds);
      notifications.show({ title: 'Créé', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      const message = error.message || 'Erreur';
      notifications.show({
        title: message.includes('existe déjà') ? 'Entrée déjà présente' : 'Erreur',
        message,
        color: message.includes('existe déjà') ? 'amber' : 'danger',
      });
    },
  });
}

export function useUpdateWeeklyActivityMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: {
      payload: Parameters<typeof updateBusinessWeeklyActivity>[1];
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await updateBusinessWeeklyActivity(businessSlug, vars.payload, meta);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ weekBounds }) => {
      invalidate(weekBounds);
      notifications.show({ title: 'Enregistré', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur',
        color: 'danger',
      });
    },
  });
}

export function useUpdateDiscordProfileMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      discordUserId: string;
      fixedDisplayName?: string;
      role?: PayrollEmployeeRole | null;
      accountNumber: number | null;
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await updateBusinessDiscordProfile(businessSlug, {
        discordUserId: vars.discordUserId,
        fixedDisplayName: vars.fixedDisplayName,
        role: vars.role,
        accountNumber: vars.accountNumber,
      });
      handleAction(result);
      return vars;
    },
    onSuccess: ({ weekBounds }) => {
      void queryClient.invalidateQueries({ queryKey: weeklyActivityKeys.all(businessSlug) });
      void queryClient.invalidateQueries({
        queryKey: weeklyActivityKeys.list(
          businessSlug,
          weeklyActivityWeekKey(weekBounds),
        ),
      });
      void queryClient.invalidateQueries({ queryKey: peopleKeys.all(businessSlug) });
      notifications.show({ title: 'Profil enregistré', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur',
        color: 'danger',
      });
    },
  });
}

export function useDeleteWeeklyActivityMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: { id: string; weekBounds: WeeklyActivityWeekBounds }) => {
      const result = await deleteBusinessWeeklyActivity(businessSlug, { id: vars.id }, meta);
      handleAction(result);
      return vars;
    },
    onSuccess: ({ weekBounds }) => {
      invalidate(weekBounds);
      notifications.show({ title: 'Supprimé', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur',
        color: 'danger',
      });
    },
  });
}

export function useMarkOwnWeeklyChestTodayMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: { weekBounds: WeeklyActivityWeekBounds }) => {
      const result = await markOwnWeeklyChestToday(businessSlug, meta);
      const data = handleAction<{
        row: WeeklyActivityListItem;
        alreadyDone?: boolean;
        message?: string;
      }>(result)!;
      return { ...vars, row: data.row, alreadyDone: data.alreadyDone, message: data.message };
    },
    onSuccess: ({ weekBounds, alreadyDone, message }) => {
      invalidate(weekBounds);
      if (alreadyDone) {
        notifications.show({
          title: 'Déjà enregistré',
          message: message ?? '',
          color: 'amber',
        });
        return;
      }
      notifications.show({ title: 'Caisse enregistrée', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur',
        color: 'danger',
      });
    },
  });
}

export function useMarkOwnWeeklyPresenceTodayMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: { weekBounds: WeeklyActivityWeekBounds }) => {
      const result = await markOwnWeeklyPresenceToday(businessSlug, meta);
      const data = handleAction<{
        row: WeeklyActivityListItem;
        alreadyDone?: boolean;
        message?: string;
      }>(result)!;
      return { ...vars, row: data.row, alreadyDone: data.alreadyDone, message: data.message };
    },
    onSuccess: ({ weekBounds, alreadyDone, message }) => {
      invalidate(weekBounds);
      if (alreadyDone) {
        notifications.show({
          title: 'Déjà enregistré',
          message: message ?? '',
          color: 'amber',
        });
        return;
      }
      notifications.show({ title: 'Présence enregistrée', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur',
        color: 'danger',
      });
    },
  });
}

export function useIncrementOwnWeeklyCounterMutation() {
  const businessSlug = useRequiredBusinessSlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: {
      /** Counter of the business type (lib/businessTypes). */
      counterKey: string;
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await incrementOwnWeeklyCounter(
        businessSlug,
        { counterKey: vars.counterKey },
        meta,
      );
      handleAction(result);
      return vars;
    },
    onSuccess: ({ weekBounds }) => {
      invalidate(weekBounds);
      notifications.show({ title: 'Compteur mis à jour', message: '', color: 'moss' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur',
        color: 'danger',
      });
    },
  });
}
