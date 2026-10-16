import type { AuthUserPublic } from '@lawless-intranet/types';
import prisma from '@/lib/prisma';
import { fetchUserProfiles } from '@/lib/authUsers';
import { applyDispensaryNamesToUsers, loadFixedNamesForUsers } from '@/lib/people/resolveNames';

/** SSO profiles of intranet accounts, named as in the dispensary (fixed name first). */
export async function fetchDispensaryUserProfiles(
  dispensaryId: string,
  userIds: string[],
): Promise<Map<string, AuthUserPublic>> {
  return applyDispensaryNamesToUsers(prisma, dispensaryId, await fetchUserProfiles(userIds));
}

/**
 * Name of the signed-in person in this dispensary (`${username}` of mails and
 * documents…): their fixed name, else `fallback` (the SSO name). Best effort.
 */
export async function getDispensaryUserName(
  dispensaryId: string,
  userId: string | null | undefined,
  fallback: string,
): Promise<string> {
  if (!userId) return fallback;
  try {
    return (await loadFixedNamesForUsers(prisma, dispensaryId, [userId])).get(userId) ?? fallback;
  } catch {
    return fallback;
  }
}
