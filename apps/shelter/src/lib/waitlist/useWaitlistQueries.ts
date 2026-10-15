'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { useWaitlistRealtime } from '@/lib/realtime/waitlist/useWaitlistRealtime';
import { waitlistKeys } from '@/lib/waitlist/queryKeys';
import type {
  AnimalWaitRequestListItem,
  OpenWaitRequestsPreview,
} from '@/types/animalWaitRequests';

export function useWaitRequests(shelterSlug: string, initialData: AnimalWaitRequestListItem[]) {
  return useQuery({
    queryKey: waitlistKeys.requests(shelterSlug),
    queryFn: async () =>
      handleAction(await fetchRead(shelterSlug, 'waitRequests', {})) as AnimalWaitRequestListItem[],
    initialData,
  });
}

export function useOpenWaitRequestsPreview(shelterSlug: string) {
  return useQuery({
    queryKey: waitlistKeys.preview(shelterSlug),
    queryFn: async (): Promise<OpenWaitRequestsPreview> => {
      const result = await fetchRead(shelterSlug, 'openWaitRequestsPreview');
      if (result.status !== 200 || !result.data) {
        throw new Error('Chargement de la file d’attente impossible');
      }
      return result.data;
    },
  });
}

/** Refetches every waitlist query (list and header preview). */
export function useInvalidateWaitlist(shelterSlug: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    // The header and the page both listen: the second call joins the first refetch.
    void queryClient.invalidateQueries(
      { queryKey: waitlistKeys.all(shelterSlug) },
      { cancelRefetch: false },
    );
  }, [queryClient, shelterSlug]);
}

/** Realtime changes from other users, and resync after a reconnection. */
export function useWaitlistRealtimeInvalidation(shelterSlug: string) {
  const invalidate = useInvalidateWaitlist(shelterSlug);
  useWaitlistRealtime({ enabled: true, onChange: invalidate, onResync: invalidate });
}
