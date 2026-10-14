import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import { listDispensaryWeeklyActivities, listDispensaryWeeklyActivityTargets } from '@/app/_actions/dispensaryWeeklyActivity';
import { getOrdersPage } from '@/app/_actions/orders';
import { listWeeklySales } from '@/app/_actions/sales';

/**
 * Reads exposed as GET (`/api/d/<slug>/read/<query>`) for React Query refetches.
 * Server actions run one at a time per tab, in the navigation queue; these run
 * in parallel. Each entry reuses the read action as-is: auth, tenant, feature
 * and permission checks stay in the action. Only the keys listed here exist.
 */
export const readRoutes = {
  weeklyActivities: (slug: string, input: { periodStart: Date; periodEnd: Date }) =>
    listDispensaryWeeklyActivities(slug, input),
  weeklyActivityTargets: (slug: string, _input?: undefined) =>
    listDispensaryWeeklyActivityTargets(slug),
  weeklySales: (slug: string, input: { weekDate?: Date }) => listWeeklySales(slug, input?.weekDate),
  ordersPage: (slug: string, input: Parameters<typeof getOrdersPage>[1]) => getOrdersPage(slug, input),
} satisfies ReadRegistry;

export type ReadRoutes = typeof readRoutes;
