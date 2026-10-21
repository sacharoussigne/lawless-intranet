import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import { listAppLogs } from '@/app/_actions/appLogs';

/**
 * Platform reads exposed as GET (`/api/platform/read/<query>`), same mechanism as
 * the tenant registry (lib/read/readRoutes) without a slug. Platform admin
 * checks stay in the actions.
 */
export const platformReadRoutes = {
  appLogs: (_slug: string, input: Parameters<typeof listAppLogs>[0]) => listAppLogs(input),
} satisfies ReadRegistry;

export type PlatformReadRoutes = typeof platformReadRoutes;
