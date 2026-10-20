import type { BusinessType } from '@prisma/client';
import { cache } from 'react';
import prisma from '@/lib/prisma';
type SessionLike = {
  user: { id: string; role?: string | null };
} | null;
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';
import { rewritePathWithBusinessSlug } from '@/lib/business/slug';
import { routes } from '@/types/routes';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';

export type BusinessContext = {
  id: string;
  slug: string;
  name: string;
  type: BusinessType;
};

export const resolveBusinessFromSlug = cache(async (slug: string): Promise<BusinessContext | null> => {
  const row = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, type: true },
  });
  return row;
});

export async function getMemberRole(
  userId: string,
  businessId: string,
): Promise<string | null> {
  const member = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: { businessId, userId },
    },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function getEffectiveRoleForBusiness(
  session: SessionLike,
  businessId: string,
): Promise<string | null> {
  if (!session?.user?.id) {
    return null;
  }
  if (isPlatformAdmin(session.user.role)) {
    return Role.ADMIN;
  }
  return getMemberRole(session.user.id, businessId);
}

export async function userCanAccessBusiness(
  session: SessionLike,
  businessId: string,
): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }
  if (isPlatformAdmin(session.user.role)) {
    return true;
  }
  const member = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: { businessId, userId: session.user.id },
    },
    select: { id: true },
  });
  return member != null;
}

/** One query for both `userCanAccessBusiness` and `getEffectiveRoleForBusiness` (every action runs it). */
async function resolveBusinessMembership(
  session: SessionLike,
  businessId: string,
): Promise<{ allowed: boolean; role: string | null }> {
  if (!session?.user?.id) {
    return { allowed: false, role: null };
  }
  if (isPlatformAdmin(session.user.role)) {
    return { allowed: true, role: Role.ADMIN };
  }
  const member = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: { businessId, userId: session.user.id },
    },
    select: { role: true },
  });
  return { allowed: member != null, role: member?.role ?? null };
}

export async function requireBusinessFromSlug(slug: string): Promise<BusinessContext> {
  const business = await resolveBusinessFromSlug(slug);
  if (!business) {
    throw new Error('DISPENSARY_NOT_FOUND');
  }
  return business;
}

export async function requireBusinessAccess(
  session: SessionLike,
  slug: string,
): Promise<{
  business: BusinessContext;
  effectiveRole: string | null;
  effectivePermissions: string[];
}> {
  const business = await requireBusinessFromSlug(slug);
  const { allowed, role: effectiveRole } = await resolveBusinessMembership(session, business.id);
  if (!allowed) {
    throw new Error('DISPENSARY_ACCESS_DENIED');
  }
  const effectivePermissions = await resolveEffectivePermissionsForBusiness(
    session,
    business.id,
    effectiveRole,
  );
  return { business, effectiveRole, effectivePermissions };
}

export async function listAccessibleBusinesses(session: SessionLike) {
  if (!session?.user?.id) {
    return [];
  }
  const select = {
    id: true,
    slug: true,
    name: true,
    type: true,
    settings: { select: { businessName: true } },
  } as const;

  const rows = isPlatformAdmin(session.user.role)
    ? await prisma.business.findMany({ orderBy: { name: 'asc' }, select })
    : await prisma.business.findMany({
        where: { members: { some: { userId: session.user.id } } },
        orderBy: { name: 'asc' },
        select,
      });

  return rows.map((d) => ({
    id: d.id,
    slug: d.slug,
    type: d.type,
    name: d.settings?.businessName?.trim() || d.name,
  }));
}

export function isBusinessAdminRole(role: string | null | undefined): boolean {
  return hasRole(role, Role.ADMIN);
}

/** Redirect target when the user cannot access the requested dispensary. */
export async function resolveBusinessAccessDeniedRedirect(
  session: SessionLike,
  pathname: string,
): Promise<string> {
  const accessible = await listAccessibleBusinesses(session);
  if (accessible.length === 0) {
    return routes.auth.noBusinessAccess;
  }
  return rewritePathWithBusinessSlug(pathname, accessible[0].slug);
}
