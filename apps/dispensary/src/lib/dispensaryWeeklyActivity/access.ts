import type { DispensaryWeeklyActivity, Prisma } from '@prisma/client';
import { can } from '@lawless-intranet/auth-permissions';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { lookupDiscordIdOfUser } from '@/lib/people/accountLinks';

export function canViewWeeklyDispensaryActivity(
  effectivePermissions: Iterable<string> | null | undefined,
): boolean {
  return can(effectivePermissions, 'weekly_dispensary_activity', 'view');
}

export function canEditAllWeeklyDispensaryActivity(
  effectivePermissions: Iterable<string> | null | undefined,
): boolean {
  return can(effectivePermissions, 'weekly_dispensary_activity', 'edit_all');
}

export function canEditOwnWeeklyDispensaryActivity(
  effectivePermissions: Iterable<string> | null | undefined,
): boolean {
  return can(effectivePermissions, 'weekly_dispensary_activity', 'edit_own');
}

/**
 * A row belongs to the person of its Discord id: the viewer owns it when their
 * account holds that Discord id today. `userId` on the row is only a cache: it
 * is used only while auth does not answer (it may be stale after a Discord
 * moved to another account, but reads reconcile it).
 */
export async function isWeeklyActivityOwner(
  _prisma: unknown,
  sessionUserId: string,
  activity: Pick<DispensaryWeeklyActivity, 'userId' | 'discordUserId'>,
): Promise<boolean> {
  const linkedDiscordId = await lookupDiscordIdOfUser(sessionUserId);
  if (linkedDiscordId === undefined) return activity.userId === sessionUserId;
  return linkedDiscordId !== null && linkedDiscordId === activity.discordUserId;
}

export async function canEditWeeklyActivity(
  prisma: unknown,
  sessionUserId: string,
  effectivePermissions: Iterable<string> | null | undefined,
  activity: Pick<DispensaryWeeklyActivity, 'userId' | 'discordUserId'>,
): Promise<boolean> {
  if (canEditAllWeeklyDispensaryActivity(effectivePermissions)) {
    return true;
  }
  if (!canEditOwnWeeklyDispensaryActivity(effectivePermissions)) {
    return false;
  }
  return isWeeklyActivityOwner(prisma, sessionUserId, activity);
}

/**
 * Rows the viewer may see, narrowed by `filter`: all of them with edit-all,
 * otherwise the rows of their current Discord id (a row belongs to a Discord
 * id, not to `userId`), or of their stored `userId` while auth does not answer.
 * The filter is ANDed, so it can never replace the viewer restriction.
 */
export async function weeklyActivityWhereForViewer(
  dispensaryId: string,
  sessionUserId: string,
  effectivePermissions: Iterable<string> | null | undefined,
  filter: Prisma.DispensaryWeeklyActivityWhereInput = {},
): Promise<Prisma.DispensaryWeeklyActivityWhereInput> {
  const tenantFilter = tenantWhere(dispensaryId);
  if (canEditAllWeeklyDispensaryActivity(effectivePermissions)) {
    return { AND: [tenantFilter, filter] };
  }
  const viewerDiscordId = await lookupDiscordIdOfUser(sessionUserId);
  const own =
    viewerDiscordId === undefined
      ? { userId: sessionUserId }
      : { discordUserId: viewerDiscordId ?? { in: [] } };
  return { AND: [{ ...tenantFilter, ...own }, filter] };
}
