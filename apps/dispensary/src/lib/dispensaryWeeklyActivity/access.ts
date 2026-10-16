import type { DispensaryWeeklyActivity } from '@prisma/client';
import { can } from '@lawless-intranet/auth-permissions';
import { discordIdOfUser } from '@/lib/people/accountLinks';

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
 * account holds that Discord id today. `userId` on the row is only a cache and
 * never grants access (it may be stale after a Discord moved to another account).
 */
export async function isWeeklyActivityOwner(
  _prisma: unknown,
  sessionUserId: string,
  activity: Pick<DispensaryWeeklyActivity, 'userId' | 'discordUserId'>,
): Promise<boolean> {
  const linkedDiscordId = await discordIdOfUser(sessionUserId);
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
