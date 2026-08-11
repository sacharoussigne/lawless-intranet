import prisma from '@/lib/prisma';
import { parseShelterSlugFromPathname } from '@/lib/shelter/slug';
import {
  getEffectiveRoleForShelter,
  userCanAccessShelter,
} from '@/lib/shelter/context';
import { resolveEffectivePermissionsForShelterUncached } from '@/lib/shelter/permissionsResolve';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function enrichSessionWithTenant(
  session: AppMiddlewareSession,
  pathname: string,
): Promise<AppMiddlewareSession> {
  if (!session?.user?.id) {
    return session;
  }
  const slug = parseShelterSlugFromPathname(pathname);
  if (!slug) {
    return session;
  }

  const shelter = await prisma.shelter.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!shelter) {
    return session;
  }

  const sessionLike = {
    user: session.user,
  } as Parameters<typeof getEffectiveRoleForShelter>[0];

  const effectiveRole = await getEffectiveRoleForShelter(sessionLike, shelter.id);
  const effectivePermissions = await resolveEffectivePermissionsForShelterUncached(
    sessionLike,
    shelter.id,
    effectiveRole,
  );

  return {
    ...session,
    tenant: {
      shelterId: shelter.id,
      shelterSlug: shelter.slug,
      effectiveRole,
      effectivePermissions,
    },
  };
}

export async function assertTenantAccessInMiddleware(
  session: AppMiddlewareSession,
): Promise<boolean> {
  if (!session?.tenant || !session.user?.id) {
    return false;
  }
  return userCanAccessShelter(
    { user: session.user } as Parameters<typeof userCanAccessShelter>[0],
    session.tenant.shelterId,
  );
}
