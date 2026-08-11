import { type NextRequest, NextResponse } from 'next/server';
import { routes, tenantRoutes } from './types/routes';
import { getRequestAuthSession } from './lib/authSession';
import { hasToBeLoggedOutMiddleware } from './middlewares/hasToBeLoggedOutMiddleware';
import { hasToBeLoggedInMiddleware } from './middlewares/hasToBeLoggedInMiddleware';
import { hasApplicationAccessMiddleware } from './middlewares/hasApplicationAccessMiddleware';
import { hasPlatformAdminMiddleware } from './middlewares/hasPlatformAdminMiddleware';
import { hasAdminRoleMiddleware } from './middlewares/hasAdminRoleMiddleware';
import { hasBankAccessMiddleware } from './middlewares/hasBankAccessMiddleware';
import { assertAppFeatureEnabledMiddleware } from './middlewares/assertAppFeatureEnabledMiddleware';
import { hasTenantAccessMiddleware } from './middlewares/hasTenantAccessMiddleware';
import { chain } from './middlewares/chain';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { enrichSessionWithTenant } from './lib/shelter/middlewareSession';
import { parseShelterSlugFromPathname } from './lib/shelter/slug';

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const session = await getRequestAuthSession(req);
  const enrichedSession: AppMiddlewareSession = session
    ? await enrichSessionWithTenant(
        {
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: session.user.role ?? null,
          },
        },
        pathname,
      )
    : null;

  const slug = parseShelterSlugFromPathname(pathname);
  const t = slug ? tenantRoutes(slug) : null;

  const middlewares = [];

  if (pathname.startsWith(routes.auth.index)) {
    if (
      pathname !== routes.auth.noAccess &&
      pathname !== routes.auth.noManagementAccess &&
      pathname !== routes.auth.noShelterAccess
    ) {
      middlewares.push(hasToBeLoggedOutMiddleware);
    }
  } else if (pathname.startsWith('/platform')) {
    middlewares.push(hasToBeLoggedInMiddleware);
    middlewares.push(hasPlatformAdminMiddleware);
  } else if (slug && t) {
    middlewares.push(hasToBeLoggedInMiddleware);
    middlewares.push(hasTenantAccessMiddleware);
    middlewares.push(hasApplicationAccessMiddleware);

    if (
      pathname === t.admin.settings ||
      pathname.startsWith(`${t.admin.settings}/`) ||
      pathname === t.admin.members ||
      pathname.startsWith(`${t.admin.members}/`)
    ) {
      middlewares.push(hasAdminRoleMiddleware);
    } else if (pathname.startsWith(t.bank.index)) {
      middlewares.push(hasBankAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'bank'),
      );
    }
  } else if (pathname === '/') {
    middlewares.push(hasToBeLoggedInMiddleware);
  } else {
    middlewares.push(hasToBeLoggedInMiddleware);
  }

  return chain(...middlewares)(req, enrichedSession);
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/',
    '/auth/:path*',
    '/platform/:path*',
    '/s/:shelterSlug/:path*',
  ],
};
