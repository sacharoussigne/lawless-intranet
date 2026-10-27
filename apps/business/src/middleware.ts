import { type NextRequest, NextResponse } from 'next/server';
import {
  routes,
  legacyPathToTenant,
  oldEmployeeModulePathToCanonical,
  prefixedBusinessPathToCanonical,
  tenantRoutes,
} from './types/routes';
import prisma from './lib/prisma';
import { businessTypeOfHost, hostOfBusinessType, requestHostOf } from './lib/business/hosts';
import { getRequestAuthSession } from './lib/authSession';
import { hasToBeLoggedOutMiddleware } from './middlewares/hasToBeLoggedOutMiddleware';
import { hasToBeLoggedInMiddleware } from './middlewares/hasToBeLoggedInMiddleware';
import { hasPlatformAdminMiddleware } from './middlewares/hasPlatformAdminMiddleware';
import { hasAdminRoleMiddleware } from './middlewares/hasAdminRoleMiddleware';
import { hasStockViewAccessMiddleware } from './middlewares/hasStockViewAccessMiddleware';
import { assertAppFeatureEnabledMiddleware } from './middlewares/assertAppFeatureEnabledMiddleware';
import { hasTenantAccessMiddleware } from './middlewares/hasTenantAccessMiddleware';
import { chain } from './middlewares/chain';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { enrichSessionWithTenant } from './lib/business/middlewareSession';
import { parseBusinessSlugFromPathname } from './lib/business/slug';
import { DEFAULT_BUSINESS_SLUG } from './lib/business/constants';
import {
  hasApplicationAccessMiddleware,
  hasBankAccessMiddleware,
  hasMailsAccessMiddleware,
  hasMediaAccessMiddleware,
  hasManagementAccessMiddleware,
  hasOrdersViewAccessMiddleware,
  hasPayrollReportsAccessMiddleware,
  hasSearchAccessMiddleware,
  hasStockStatisticsAccessMiddleware,
  hasWeeklyActivityEditAllMiddleware,
  hasWeeklyActivityMiddleware,
} from './middlewares/permissionMiddlewares';

function redirectKeepingQuery(req: NextRequest, target: string): NextResponse {
  const url = new URL(target, req.url);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url, 308);
}

/**
 * A business opened on the host of another kind of business (BUSINESS_TYPE_HOSTS)
 * moves to its own host, same path. The main host serves every business.
 */
async function wrongHostRedirect(req: NextRequest, slug: string): Promise<NextResponse | null> {
  const current = requestHostOf(req.headers, req.nextUrl.protocol.replace(':', ''));
  const hostType = businessTypeOfHost(current.host);
  if (!hostType) return null;
  const business = await prisma.business.findUnique({ where: { slug }, select: { type: true } });
  if (!business || business.type === hostType) return null;
  const targetHost = hostOfBusinessType(business.type);
  if (!targetHost) return null;
  const url = new URL(`${current.proto}://${targetHost}${req.nextUrl.pathname}`);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url, 308);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // The `/d/` prefix of business pages was dropped: `/d/<slug>/…` → `/<slug>/…`.
  const unprefixed = prefixedBusinessPathToCanonical(pathname);
  if (unprefixed) {
    return redirectKeepingQuery(req, unprefixed);
  }

  const legacyTarget = legacyPathToTenant(pathname, DEFAULT_BUSINESS_SLUG);
  if (legacyTarget) {
    return redirectKeepingQuery(req, legacyTarget);
  }

  const slug = parseBusinessSlugFromPathname(pathname);

  const employeeModuleTarget = slug ? oldEmployeeModulePathToCanonical(pathname) : null;
  if (employeeModuleTarget) {
    return redirectKeepingQuery(req, employeeModuleTarget);
  }

  if (slug) {
    const hostRedirect = await wrongHostRedirect(req, slug);
    if (hostRedirect) return hostRedirect;
  }

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
          viewAs: session.viewAs ?? null,
        },
        pathname,
      )
    : null;

  const t = slug ? tenantRoutes(slug) : null;

  const middlewares = [];

  if (pathname.startsWith(routes.auth.index)) {
    if (
      pathname !== routes.auth.noAccess &&
      pathname !== routes.auth.noManagementAccess &&
      pathname !== routes.auth.noBusinessAccess
    ) {
      middlewares.push(hasToBeLoggedOutMiddleware);
    }
  } else if (pathname.startsWith('/platform')) {
    middlewares.push(hasToBeLoggedInMiddleware);
    middlewares.push(hasPlatformAdminMiddleware);
  } else if (pathname === '/admin/users' || pathname.startsWith('/admin/users/')) {
    const suffix = pathname.slice('/admin/users'.length);
    return NextResponse.redirect(new URL(`/platform/users${suffix}`, req.url));
  } else if (slug && t) {
    middlewares.push(hasToBeLoggedInMiddleware);
    middlewares.push(hasTenantAccessMiddleware);
    middlewares.push(hasApplicationAccessMiddleware);

    if (pathname.startsWith(`${t.management.index}`)) {
      middlewares.push(hasManagementAccessMiddleware);
      if (pathname === t.management.people || pathname.startsWith(`${t.management.people}/`)) {
        middlewares.push(hasWeeklyActivityEditAllMiddleware);
        middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
          assertAppFeatureEnabledMiddleware(request, s, 'weeklyActivity'),
        );
      }
    } else if (
      pathname === t.admin.settings ||
      pathname.startsWith(`${t.admin.settings}/`) ||
      pathname === t.admin.overwriteStock ||
      pathname.startsWith(`${t.admin.overwriteStock}/`) ||
      pathname === t.admin.members ||
      pathname.startsWith(`${t.admin.members}/`) ||
      pathname === t.admin.agendas ||
      pathname.startsWith(`${t.admin.agendas}/`) ||
      pathname === t.admin.cabinets ||
      pathname.startsWith(`${t.admin.cabinets}/`)
    ) {
      middlewares.push(hasAdminRoleMiddleware);
      if (pathname === t.admin.settings || pathname.startsWith(`${t.admin.settings}/`)) {
        // settings page only
      }
      if (pathname === t.admin.overwriteStock || pathname.startsWith(`${t.admin.overwriteStock}/`)) {
        middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
          assertAppFeatureEnabledMiddleware(request, s, 'stock'),
        );
      }
    } else if (pathname.startsWith(t.admin.payroll)) {
      middlewares.push(hasPayrollReportsAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'payroll'),
      );
    } else if (pathname.startsWith(t.stock.index)) {
      middlewares.push(hasStockViewAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'stock'),
      );
    } else if (pathname.startsWith(t.orders.index)) {
      middlewares.push(hasOrdersViewAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'orders'),
      );
    } else if (pathname.startsWith(t.searchItems.index)) {
      middlewares.push(hasSearchAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'search'),
      );
    } else if (pathname.startsWith(t.bank.index)) {
      middlewares.push(hasBankAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'bank'),
      );
    } else if (pathname.startsWith(t.weeklyActivity.index)) {
      middlewares.push(hasWeeklyActivityMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'weeklyActivity'),
      );
    } else if (pathname.startsWith(t.media.index)) {
      middlewares.push(hasMediaAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'media'),
      );
    } else if (pathname.startsWith(t.agenda.index)) {
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'agenda'),
      );
    } else if (pathname.startsWith(t.cabinet.index)) {
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'cabinet'),
      );
    } else if (
      pathname === t.employee.payroll ||
      pathname.startsWith(`${t.employee.payroll}/`)
    ) {
      middlewares.push(hasPayrollReportsAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'payroll'),
      );
    } else if (
      pathname === t.employee.stockStatistics ||
      pathname.startsWith(`${t.employee.stockStatistics}/`) ||
      pathname === t.employee.stockMovements ||
      pathname.startsWith(`${t.employee.stockMovements}/`)
    ) {
      middlewares.push(hasStockStatisticsAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'stock'),
      );
    } else if (
      pathname === t.employee.sales ||
      pathname.startsWith(`${t.employee.sales}/`)
    ) {
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'sales'),
      );
    } else if (pathname.startsWith(t.employee.mails)) {
      middlewares.push(hasMailsAccessMiddleware);
      middlewares.push((request: NextRequest, s: AppMiddlewareSession) =>
        assertAppFeatureEnabledMiddleware(request, s, 'mails'),
      );
    }
  } else if (pathname.startsWith(routes.settings.index)) {
    middlewares.push(hasToBeLoggedInMiddleware);
  } else if (pathname === '/') {
    middlewares.push(hasToBeLoggedInMiddleware);
  } else if (!pathname.startsWith('/platform') && !pathname.startsWith('/admin/users')) {
    middlewares.push(hasToBeLoggedInMiddleware);
    middlewares.push(hasApplicationAccessMiddleware);
  } else {
    middlewares.push(hasToBeLoggedInMiddleware);
  }

  return chain(...middlewares)(req, enrichedSession);
}

export const config = {
  runtime: 'nodejs',
  // Every page: business pages live at `/<slug>/…`. Not the API, Next assets,
  // public share links nor static files (a dot in the path).
  matcher: ['/((?!api/|_next/|partage/|.*\\..*).*)'],
};
