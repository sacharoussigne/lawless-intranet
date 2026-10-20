import type { AuthUserPublic } from '@lawless-intranet/types';
import prisma from '@/lib/prisma';
import { fetchUserProfiles } from '@/lib/authUsers';
import { applyBusinessNamesToUsers, loadFixedNamesForUsers } from '@/lib/people/resolveNames';

/** SSO profiles of intranet accounts, named as in the dispensary (fixed name first). */
export async function fetchBusinessUserProfiles(
  businessId: string,
  userIds: string[],
): Promise<Map<string, AuthUserPublic>> {
  return applyBusinessNamesToUsers(prisma, businessId, await fetchUserProfiles(userIds));
}

/**
 * Name of the signed-in person in this dispensary (`${username}` of mails and
 * documents…): their fixed name, else `fallback` (the SSO name). Best effort.
 */
export async function getBusinessUserName(
  businessId: string,
  userId: string | null | undefined,
  fallback: string,
): Promise<string> {
  if (!userId) return fallback;
  try {
    return (await loadFixedNamesForUsers(prisma, businessId, [userId])).get(userId) ?? fallback;
  } catch {
    return fallback;
  }
}
