'use client';

import { useOptionalRealtimeClientId } from '@lawless-intranet/realtime/client';

/** @deprecated Prefer DispensaryRealtimeShell's shared RealtimeProvider. */
export function WeeklyActivityRealtimeProvider({
  children,
}: {
  streamUrl?: string;
  children: React.ReactNode;
}) {
  return children;
}

export function useOptionalWeeklyActivityRealtimeClientId(): string | undefined {
  return useOptionalRealtimeClientId();
}
