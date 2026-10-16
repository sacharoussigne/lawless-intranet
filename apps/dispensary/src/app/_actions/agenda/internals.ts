import { requireTenantServerActionContext, type AuthSession } from '@/lib/serverActionAuth';
import { applyDispensaryNamesToUsers, findUserIdsByDispensaryName } from '@/lib/people/resolveNames';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/dispensary/platformAdmin';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { batchGetUsers, searchUsers } from '@lawless-intranet/auth-client/server';
import { getCookieHeader } from '@/lib/authUsers';
import { isDispensaryAdminRole } from '@/lib/agenda/access';

export type AgendaEligibleUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function searchEligibleDispensaryUsersForAgenda(
  dispensaryId: string,
  query: string,
): Promise<AgendaEligibleUser[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const cookieHeader = await getCookieHeader();
  const [members, matchingUsers, matchingByDispensaryName] = await Promise.all([
    prisma.dispensaryMember.findMany({
      where: { dispensaryId },
      select: { userId: true },
    }),
    searchUsers(q, cookieHeader),
    findUserIdsByDispensaryName(prisma, dispensaryId, q),
  ]);

  const memberIds = new Set(members.map((member) => member.userId));
  const candidateIds = new Set<string>();

  for (const user of matchingUsers) {
    if (memberIds.has(user.id)) {
      candidateIds.add(user.id);
    } else if (isPlatformAdmin(user.role)) {
      candidateIds.add(user.id);
    }
  }
  // Members found by their name in the dispensary (fixed name), not only their account name.
  for (const userId of matchingByDispensaryName) {
    if (memberIds.has(userId)) candidateIds.add(userId);
  }

  const profiles = await applyDispensaryNamesToUsers(
    prisma,
    dispensaryId,
    new Map((await batchGetUsers([...candidateIds], cookieHeader)).map((user) => [user.id, user])),
  );

  return [...profiles.values()]
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email ?? '',
      image: user.image,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .slice(0, 20);
}

export async function requireAgendaFeatureContext(dispensarySlug: string) {
  return requireTenantServerActionContext(dispensarySlug, {
    feature: 'agenda',
  });
}

export async function getAgendaSessionContext(dispensarySlug: string) {
  const ctx = await requireAgendaFeatureContext(dispensarySlug);
  if (!ctx.ok) return ctx;
  return {
    ok: true as const,
    tenant: ctx.tenant,
    session: ctx.session,
  };
}

export function isScopeAdmin(
  session: AuthSession,
  effectiveRole: string | null | undefined,
): boolean {
  return isDispensaryAdminRole(session.user.role, effectiveRole);
}

export async function validateDispensaryUserIds(
  dispensaryId: string,
  userIds: string[],
): Promise<boolean> {
  if (userIds.length === 0) return true;

  const cookieHeader = await getCookieHeader();
  const users = await batchGetUsers(userIds, cookieHeader);
  if (users.length !== userIds.length) return false;

  const memberRequiredIds = users
    .filter((user) => !isPlatformAdmin(user.role))
    .map((user) => user.id);

  if (memberRequiredIds.length === 0) return true;

  const memberCount = await prisma.dispensaryMember.count({
    where: {
      ...tenantWhere(dispensaryId),
      userId: { in: memberRequiredIds },
    },
  });

  return memberCount === memberRequiredIds.length;
}
