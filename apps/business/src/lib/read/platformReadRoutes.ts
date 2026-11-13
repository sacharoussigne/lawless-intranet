import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import { listAppLogs } from '@/app/_actions/appLogs';
import { listUsers } from '@/app/_actions/users';

/**
 * Platform reads exposed as GET (`/api/platform/read/<query>`), same mechanism as
 * the tenant registry (lib/read/readRoutes) without a slug. Platform admin
 * checks stay in the actions.
 */
export const platformReadRoutes = {
  appLogs: (_slug: string, input: Parameters<typeof listAppLogs>[0]) => listAppLogs(input),
  users: (_slug: string, input: Parameters<typeof listUsers>[0]) => listUsers(input),
} satisfies ReadRegistry;

export type PlatformReadRoutes = typeof platformReadRoutes;
