import prisma from '@/lib/prisma';
import { accountIdOfDiscord } from '@/lib/people/accountLinks';
import { canEditPastWeeks, isCurrentBankWeek, PAST_WEEK_LOCKED_MESSAGE } from './weekLock';

/** Bot requests only carry a Discord id: the member role of its account in the business decides. */
export async function discordUserCanEditPastWeeks(businessId: string, discordUserId: string): Promise<boolean> {
  const userId = await accountIdOfDiscord(discordUserId);
  if (!userId) return false;
  const member = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { role: true },
  });
  return canEditPastWeeks(member?.role);
}

/** Message when this bot user may not touch the week of `date`, else null (no lookup for the current week). */
export async function botPastWeekLockError(
  businessId: string,
  discordUserId: string,
  date: Date,
): Promise<string | null> {
  if (isCurrentBankWeek(date)) return null;
  return (await discordUserCanEditPastWeeks(businessId, discordUserId)) ? null : PAST_WEEK_LOCKED_MESSAGE;
}

export class PastWeekLockedError extends Error {
  constructor() {
    super(PAST_WEEK_LOCKED_MESSAGE);
    this.name = 'PastWeekLockedError';
  }
}
