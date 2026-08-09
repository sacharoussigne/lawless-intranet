import type { DispensaryWeeklyActivity } from '@prisma/client';
import { can } from '@lawless-intranet/auth-permissions';
import { findDiscordIdByUserId } from '@lawless-intranet/auth-client/internal';

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

export async function isWeeklyActivityOwner(
  _prisma: unknown,
  sessionUserId: string,
  activity: Pick<DispensaryWeeklyActivity, 'userId' | 'discordUserId'>,
): Promise<boolean> {
  if (activity.userId && activity.userId === sessionUserId) {
    return true;
  }

  const linkedDiscordId = await findDiscordIdByUserId(sessionUserId);
  return linkedDiscordId === activity.discordUserId;
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
