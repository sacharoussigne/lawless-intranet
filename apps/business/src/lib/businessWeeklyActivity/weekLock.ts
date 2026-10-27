import { hasRole } from '@lawless-intranet/auth-permissions';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { Role } from '@/types/enum/roles';

export const PAST_WEEK_LOCKED_MESSAGE = 'Semaine passée : seule la direction peut la modifier';

/** Admin and direction may edit any week; the others only the current Paris bank week. */
export function canEditPastWeeks(effectiveRole: string | null | undefined): boolean {
  return hasRole(effectiveRole, Role.ADMIN) || hasRole(effectiveRole, Role.DIRECTION);
}

export function isCurrentBankWeek(date: Date | string, now: Date = new Date()): boolean {
  return getBankWeekBounds(new Date(date)).start.getTime() === getBankWeekBounds(now).start.getTime();
}

/** Weekly activity rows and sales of a past week are read-only without `canEditPastWeeks`. */
export function isWeekLocked(
  date: Date | string,
  effectiveRole: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return !canEditPastWeeks(effectiveRole) && !isCurrentBankWeek(date, now);
}
