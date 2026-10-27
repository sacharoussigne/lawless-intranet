import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { listBusinessWeeklyActivities } from '@/app/_actions/businessWeeklyActivity';
import { resolveDiscordPersonName } from '@/lib/people/resolveNames';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getAuthSession } from '@/lib/authSession';
import { can } from '@lawless-intranet/auth-permissions';
import { getBankWeekBounds } from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import {
  getDiscordAccountIdForUser,
} from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import prisma from '@/lib/prisma';
import { getDataOrThrow } from '@/lib/response';
import type { AuthSession } from '@/types/session';
import WeeklyActivityPageClient from './WeeklyActivityPageClient';

async function WeeklyActivityContent({ businessSlug }: { businessSlug: string }) {
  const session = await getAuthSession();
  if (!session?.user) {
    return null;
  }

  const business = await requireBusinessFromSlug(businessSlug);
  const effectiveRole = await getEffectiveRoleForBusiness(session as AuthSession, business.id);
  const effectivePermissions = await resolveEffectivePermissionsForBusiness(
    session as AuthSession,
    business.id,
    effectiveRole,
  );

  // The middleware already guards the page; checked again for direct renders.
  if (!can(effectivePermissions, 'weekly_activity', 'page')) {
    redirect(tenantRoutes(businessSlug).employee.index);
  }

  const week = getBankWeekBounds(dayjs().tz('Europe/Paris').startOf('day').toDate());
  const initialWeekBounds = { periodStart: week.start, periodEnd: week.end };

  const [result, viewerDiscordId] = await Promise.all([
    listBusinessWeeklyActivities(businessSlug, initialWeekBounds),
    getDiscordAccountIdForUser(prisma, session.user.id),
  ]);
  const rows = getDataOrThrow(result, 'Erreur lors du chargement de l’activité hebdomadaire');

  const canEditAll = can(effectivePermissions, 'weekly_activity', 'edit_all');
  const canEdit =
    canEditAll ||
    can(effectivePermissions, 'weekly_activity', 'edit_own');

  const defaultDisplayName = viewerDiscordId
    ? await resolveDiscordPersonName(prisma, business.id, viewerDiscordId, session.user.name)
    : session.user.name;

  return (
    <WeeklyActivityPageClient
      initialWeekBounds={initialWeekBounds}
      initialRows={rows}
      canEditAll={canEditAll}
      canEdit={canEdit}
      sessionUserId={session.user.id}
      viewerDiscordId={viewerDiscordId}
      defaultDisplayName={defaultDisplayName}
    />
  );
}

export default async function WeeklyActivityPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  return (
    <SuspenseLoader>
      <WeeklyActivityContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
