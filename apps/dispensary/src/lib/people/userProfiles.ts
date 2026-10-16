import type { AuthUserPublic } from '@lawless-intranet/types';
import prisma from '@/lib/prisma';
import { fetchUserProfiles } from '@/lib/authUsers';
import { applyDispensaryNamesToUsers } from '@/lib/people/resolveNames';

/** SSO profiles of intranet accounts, named as in the dispensary (fixed name first). */
export async function fetchDispensaryUserProfiles(
  dispensaryId: string,
  userIds: string[],
): Promise<Map<string, AuthUserPublic>> {
  return applyDispensaryNamesToUsers(prisma, dispensaryId, await fetchUserProfiles(userIds));
}
