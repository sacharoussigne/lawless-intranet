import prisma from '@/lib/prisma';
import { parseDispensarySlugFromPathname } from '@/lib/dispensary/slug';
import {
  getEffectiveRoleForDispensary,
  userCanAccessDispensary,
} from '@/lib/dispensary/context';
import { resolveEffectivePermissionsForDispensaryUncached } from '@/lib/dispensary/permissionsResolve';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function enrichSessionWithTenant(
  session: AppMiddlewareSession,
  pathname: string,
): Promise<AppMiddlewareSession> {
  if (!session?.user?.id) {
    return session;
  }
  const slug = parseDispensarySlugFromPathname(pathname);
  if (!slug) {
    return session;
  }

  const dispensary = await prisma.dispensary.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!dispensary) {
    return session;
  }

  const sessionLike = {
    user: session.user,
  } as Parameters<typeof getEffectiveRoleForDispensary>[0];

  const effectiveRole = await getEffectiveRoleForDispensary(sessionLike, dispensary.id);
  const effectivePermissions = await resolveEffectivePermissionsForDispensaryUncached(
    sessionLike,
    dispensary.id,
    effectiveRole,
  );

  return {
    ...session,
    tenant: {
      dispensaryId: dispensary.id,
      dispensarySlug: dispensary.slug,
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
  return userCanAccessDispensary(
    { user: session.user } as Parameters<typeof userCanAccessDispensary>[0],
    session.tenant.dispensaryId,
  );
}
