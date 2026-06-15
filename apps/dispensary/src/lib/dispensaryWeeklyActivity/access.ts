import type { DispensaryWeeklyActivity } from '@prisma/client';
import { checkRolePermission } from '@lawless-intranet/auth-permissions';
import { findDiscordIdByUserId } from '@lawless-intranet/auth-client/internal';

export function canViewWeeklyDispensaryActivity(role: string | null | undefined): boolean {
  return checkRolePermission(role, 'weekly_dispensary_activity', 'view');
}

export function canEditAllWeeklyDispensaryActivity(role: string | null | undefined): boolean {
  return checkRolePermission(role, 'weekly_dispensary_activity', 'edit_all');
}

export function canEditOwnWeeklyDispensaryActivity(role: string | null | undefined): boolean {
  return checkRolePermission(role, 'weekly_dispensary_activity', 'edit_own');
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
  role: string | null | undefined,
  activity: Pick<DispensaryWeeklyActivity, 'userId' | 'discordUserId'>,
): Promise<boolean> {
  if (canEditAllWeeklyDispensaryActivity(role)) {
    return true;
  }
  if (!canEditOwnWeeklyDispensaryActivity(role)) {
    return false;
  }
  return isWeeklyActivityOwner(prisma, sessionUserId, activity);
}
