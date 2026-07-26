'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import {
  createDispensaryWeeklyActivity,
  deleteDispensaryWeeklyActivity,
  getDispensaryWeeklyActivityHistory,
  incrementOwnWeeklyCounter,
  listDispensaryWeeklyActivities,
  listDispensaryWeeklyActivityTargets,
  markOwnWeeklyChestToday,
  markOwnWeeklyPresenceToday,
  updateDispensaryWeeklyActivity,
} from '@/app/_actions/dispensaryWeeklyActivity';
import { handleAction } from '@/lib/action';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import {
  isSameWeeklyActivityWeek,
  normalizeWeeklyActivityWeekBounds,
  weeklyActivityWeekKey,
  type WeeklyActivityWeekBounds,
} from '@/lib/dispensaryWeeklyActivity/queryKeys';
import type { SerializedDispensaryWeeklyActivityRow } from '@/lib/dispensaryWeeklyActivity/apiRow';
import { useOptionalWeeklyActivityRealtimeClientId } from '@/lib/dispensaryWeeklyActivity/realtime/client/WeeklyActivityRealtimeProvider';
import { weeklyActivityMutationMeta } from '@/lib/dispensaryWeeklyActivity/realtime/client/mutationMeta';
import type { WeeklyActivityRealtimeEvent } from '@/lib/dispensaryWeeklyActivity/realtime/types';

export type WeeklyActivityListItem = SerializedDispensaryWeeklyActivityRow;

export type WeeklyActivityHistoryEntry = {
  id: string;
  action: string;
  source: string;
  actorUserName: string | null;
  actorResolvedName: string | null;
  actorDiscordUserId: string | null;
  createdAt: string;
  previousValues: unknown;
  nextValues: unknown;
};

export type WeeklyActivityTargetUser = {
  id: string;
  name: string;
  discordDisplayName: string;
};

export const weeklyActivityKeys = {
  all: (slug: string) => ['weeklyActivity', slug] as const,
  list: (slug: string, weekKey: string) =>
    [...weeklyActivityKeys.all(slug), 'list', weekKey] as const,
  history: (slug: string, activityId: string) =>
    [...weeklyActivityKeys.all(slug), 'history', activityId] as const,
  targets: (slug: string) => [...weeklyActivityKeys.all(slug), 'targets'] as const,
};

async function fetchWeeklyActivities(
  dispensarySlug: string,
  bounds: WeeklyActivityWeekBounds,
): Promise<WeeklyActivityListItem[]> {
  const normalized = normalizeWeeklyActivityWeekBounds(bounds);
  const result = await listDispensaryWeeklyActivities(dispensarySlug, normalized);
  const data = handleAction(result);
  return Array.isArray(data) ? data : [];
}

async function fetchWeeklyActivityHistory(
  dispensarySlug: string,
  activityId: string,
): Promise<WeeklyActivityHistoryEntry[]> {
  const result = await getDispensaryWeeklyActivityHistory(dispensarySlug, { id: activityId });
  const data = handleAction(result);
  return Array.isArray(data) ? data : [];
}

async function fetchWeeklyActivityTargets(
  dispensarySlug: string,
): Promise<WeeklyActivityTargetUser[]> {
  const result = await listDispensaryWeeklyActivityTargets(dispensarySlug);
  const data = handleAction(result) as { users?: WeeklyActivityTargetUser[] } | undefined;
  return data?.users ?? [];
}

function useWeeklyActivityMutationMeta() {
  const clientId = useOptionalWeeklyActivityRealtimeClientId();
  return weeklyActivityMutationMeta(clientId);
}

export function invalidateWeeklyActivityFromRealtimeEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  dispensarySlug: string,
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
        dispensarySlug,
        weeklyActivityWeekKey(options.visibleWeekBounds),
      ),
    });
  } else if (!options?.visibleWeekBounds) {
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.all(dispensarySlug),
    });
  }

  if (options?.openHistoryActivityId && options.openHistoryActivityId === event.activityId) {
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.history(dispensarySlug, event.activityId),
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
  const dispensarySlug = useRequiredDispensarySlug();
  const weekKey = weekBounds ? weeklyActivityWeekKey(weekBounds) : '';

  return useQuery({
    queryKey: weeklyActivityKeys.list(dispensarySlug, weekKey),
    queryFn: () => {
      if (!weekBounds) throw new Error('weekBounds is required');
      return fetchWeeklyActivities(dispensarySlug, weekBounds);
    },
    initialData:
      initialData &&
      weekBounds &&
      isSameWeeklyActivityWeek(initialData.bounds, weekBounds)
        ? initialData.rows
        : undefined,
    placeholderData: (previous) => previous,
    enabled: Boolean(dispensarySlug && weekBounds),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useWeeklyActivityHistory(activityId: string | null, enabled: boolean) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: weeklyActivityKeys.history(dispensarySlug, activityId ?? ''),
    queryFn: () => {
      if (!activityId) throw new Error('activityId is required');
      return fetchWeeklyActivityHistory(dispensarySlug, activityId);
    },
    enabled: Boolean(activityId && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useWeeklyActivityTargets(enabled: boolean) {
  const dispensarySlug = useRequiredDispensarySlug();

  return useQuery({
    queryKey: weeklyActivityKeys.targets(dispensarySlug),
    queryFn: () => fetchWeeklyActivityTargets(dispensarySlug),
    enabled: Boolean(dispensarySlug && enabled),
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}

export function useInvalidateWeeklyActivities() {
  const queryClient = useQueryClient();
  const dispensarySlug = useRequiredDispensarySlug();

  return (bounds?: WeeklyActivityWeekBounds) => {
    if (bounds) {
      void queryClient.invalidateQueries({
        queryKey: weeklyActivityKeys.list(
          dispensarySlug,
          weeklyActivityWeekKey(bounds),
        ),
      });
      return;
    }
    void queryClient.invalidateQueries({
      queryKey: weeklyActivityKeys.all(dispensarySlug),
    });
  };
}

export function useCreateWeeklyActivityMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: {
      payload: Parameters<typeof createDispensaryWeeklyActivity>[1];
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await createDispensaryWeeklyActivity(dispensarySlug, vars.payload, meta);
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
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: {
      payload: Parameters<typeof updateDispensaryWeeklyActivity>[1];
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await updateDispensaryWeeklyActivity(dispensarySlug, vars.payload, meta);
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

export function useDeleteWeeklyActivityMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: { id: string; weekBounds: WeeklyActivityWeekBounds }) => {
      const result = await deleteDispensaryWeeklyActivity(dispensarySlug, { id: vars.id }, meta);
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
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: { weekBounds: WeeklyActivityWeekBounds }) => {
      const result = await markOwnWeeklyChestToday(dispensarySlug, meta);
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
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: { weekBounds: WeeklyActivityWeekBounds }) => {
      const result = await markOwnWeeklyPresenceToday(dispensarySlug, meta);
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

type WeeklyCounterField =
  | 'sherifCount'
  | 'patientsCount'
  | 'infusionsCount'
  | 'poppyMilkCount';

export function useIncrementOwnWeeklyCounterMutation() {
  const dispensarySlug = useRequiredDispensarySlug();
  const invalidate = useInvalidateWeeklyActivities();
  const meta = useWeeklyActivityMutationMeta();

  return useMutation({
    mutationFn: async (vars: {
      field: WeeklyCounterField;
      weekBounds: WeeklyActivityWeekBounds;
    }) => {
      const result = await incrementOwnWeeklyCounter(
        dispensarySlug,
        { field: vars.field },
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
