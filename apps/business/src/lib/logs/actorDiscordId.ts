import { discordIdOfUser } from '@/lib/people/accountLinks';

/**
 * Discord id of an intranet account, for the logs of its actions: a search by
 * Discord id then also finds what the person did on the intranet. Uses the
 * shared, bounded account-link cache. Null for an account without Discord or
 * when the auth service does not answer.
 */
export async function discordIdForLog(userId: string | null | undefined): Promise<string | null> {
  return discordIdOfUser(userId);
}
