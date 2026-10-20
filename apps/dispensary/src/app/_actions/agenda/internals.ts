import { requireTenantServerActionContext, type AuthSession } from '@/lib/serverActionAuth';
import { applyBusinessNamesToUsers, findUserIdsByBusinessName } from '@/lib/people/resolveNames';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { batchGetUsers, searchUsers } from '@lawless-intranet/auth-client/server';
import { getCookieHeader } from '@/lib/authUsers';
import { isBusinessAdminRole } from '@/lib/agenda/access';

export type AgendaEligibleUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function searchEligibleBusinessUsersForAgenda(
  businessId: string,
  query: string,
): Promise<AgendaEligibleUser[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const cookieHeader = await getCookieHeader();
  const [members, matchingUsers, matchingByBusinessName] = await Promise.all([
    prisma.businessMember.findMany({
      where: { businessId },
      select: { userId: true },
    }),
    searchUsers(q, cookieHeader),
    findUserIdsByBusinessName(prisma, businessId, q),
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
  for (const userId of matchingByBusinessName) {
    if (memberIds.has(userId)) candidateIds.add(userId);
  }

  const profiles = await applyBusinessNamesToUsers(
    prisma,
    businessId,
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

export async function requireAgendaFeatureContext(businessSlug: string) {
  return requireTenantServerActionContext(businessSlug, {
    feature: 'agenda',
  });
}

export async function getAgendaSessionContext(businessSlug: string) {
  const ctx = await requireAgendaFeatureContext(businessSlug);
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
  return isBusinessAdminRole(session.user.role, effectiveRole);
}

export async function validateBusinessUserIds(
  businessId: string,
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

  const memberCount = await prisma.businessMember.count({
    where: {
      ...tenantWhere(businessId),
      userId: { in: memberRequiredIds },
    },
  });

  return memberCount === memberRequiredIds.length;
}
