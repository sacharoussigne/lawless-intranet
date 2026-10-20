import prisma from '@/lib/prisma';
import { parseBusinessSlugFromPathname } from '@/lib/business/slug';
import {
  getEffectiveRoleForBusiness,
  userCanAccessBusiness,
} from '@/lib/business/context';
import { resolveEffectivePermissionsForBusinessUncached } from '@/lib/business/permissionsResolve';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function enrichSessionWithTenant(
  session: AppMiddlewareSession,
  pathname: string,
): Promise<AppMiddlewareSession> {
  if (!session?.user?.id) {
    return session;
  }
  const slug = parseBusinessSlugFromPathname(pathname);
  if (!slug) {
    return session;
  }

  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!business) {
    return session;
  }

  const sessionLike = {
    user: session.user,
  } as Parameters<typeof getEffectiveRoleForBusiness>[0];

  const effectiveRole = await getEffectiveRoleForBusiness(sessionLike, business.id);
  const effectivePermissions = await resolveEffectivePermissionsForBusinessUncached(
    sessionLike,
    business.id,
    effectiveRole,
  );

  return {
    ...session,
    tenant: {
      businessId: business.id,
      businessSlug: business.slug,
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
  return userCanAccessBusiness(
    { user: session.user } as Parameters<typeof userCanAccessBusiness>[0],
    session.tenant.businessId,
  );
}
