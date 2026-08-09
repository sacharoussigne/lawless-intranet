'use client';

import { useOptionalRealtimeClientId } from '@lawless-intranet/realtime/client';

/** @deprecated Prefer DispensaryRealtimeShell's shared RealtimeProvider. */
export function SalesRealtimeProvider({
  children,
}: {
  streamUrl?: string;
  children: React.ReactNode;
}) {
  return children;
}

export function useOptionalSalesRealtimeClientId(): string | undefined {
  return useOptionalRealtimeClientId();
}
