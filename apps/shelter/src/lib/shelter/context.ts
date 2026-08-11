import { cache } from 'react';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/shelter/platformAdmin';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';
import { rewritePathWithShelterSlug } from '@/lib/shelter/slug';
import { routes } from '@/types/routes';
import { resolveEffectivePermissionsForShelter } from '@/lib/shelter/permissionsResolve';

type SessionLike = {
  user: { id: string; role?: string | null };
} | null;

export type ShelterContext = {
  id: string;
  slug: string;
  name: string;
};

export const resolveShelterFromSlug = cache(async (slug: string): Promise<ShelterContext | null> => {
  const row = await prisma.shelter.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  return row;
});

export async function getMemberRole(
  userId: string,
  shelterId: string,
): Promise<string | null> {
  const member = await prisma.shelterMember.findUnique({
    where: {
      shelterId_userId: { shelterId, userId },
    },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function getEffectiveRoleForShelter(
  session: SessionLike,
  shelterId: string,
): Promise<string | null> {
  if (!session?.user?.id) {
    return null;
  }
  if (isPlatformAdmin(session.user.role)) {
    return Role.ADMIN;
  }
  return getMemberRole(session.user.id, shelterId);
}

export async function userCanAccessShelter(
  session: SessionLike,
  shelterId: string,
): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }
  if (isPlatformAdmin(session.user.role)) {
    return true;
  }
  const member = await prisma.shelterMember.findUnique({
    where: {
      shelterId_userId: { shelterId, userId: session.user.id },
    },
    select: { id: true },
  });
  return member != null;
}

export async function requireShelterFromSlug(slug: string): Promise<ShelterContext> {
  const shelter = await resolveShelterFromSlug(slug);
  if (!shelter) {
    throw new Error('SHELTER_NOT_FOUND');
  }
  return shelter;
}

export async function requireShelterAccess(
  session: SessionLike,
  slug: string,
): Promise<{
  shelter: ShelterContext;
  effectiveRole: string | null;
  effectivePermissions: string[];
}> {
  const shelter = await requireShelterFromSlug(slug);
  const allowed = await userCanAccessShelter(session, shelter.id);
  if (!allowed) {
    throw new Error('SHELTER_ACCESS_DENIED');
  }
  const effectiveRole = await getEffectiveRoleForShelter(session, shelter.id);
  const effectivePermissions = await resolveEffectivePermissionsForShelter(
    session,
    shelter.id,
    effectiveRole,
  );
  return { shelter, effectiveRole, effectivePermissions };
}

export async function listAccessibleShelters(session: SessionLike) {
  if (!session?.user?.id) {
    return [];
  }
  const select = {
    id: true,
    slug: true,
    name: true,
    settings: { select: { shelterName: true } },
  } as const;

  const rows = isPlatformAdmin(session.user.role)
    ? await prisma.shelter.findMany({ orderBy: { name: 'asc' }, select })
    : await prisma.shelter.findMany({
        where: { members: { some: { userId: session.user.id } } },
        orderBy: { name: 'asc' },
        select,
      });

  return rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.settings?.shelterName?.trim() || s.name,
  }));
}

export function isShelterAdminRole(role: string | null | undefined): boolean {
  return hasRole(role, Role.ADMIN);
}

export async function resolveShelterAccessDeniedRedirect(
  session: SessionLike,
  pathname: string,
): Promise<string> {
  const accessible = await listAccessibleShelters(session);
  if (accessible.length === 0) {
    return routes.auth.noShelterAccess;
  }
  return rewritePathWithShelterSlug(pathname, accessible[0].slug);
}
