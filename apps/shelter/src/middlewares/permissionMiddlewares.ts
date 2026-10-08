import { type NextRequest, NextResponse } from 'next/server';
import { routes } from '@/types/routes';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { middlewareHasPermission } from '@/types/middlewareSession';

type NoAccessRoute = 'noAccess';

/** Middleware redirecting to the no-access page unless the user has `resource:action`. */
function requirePermissionMiddleware(
  resource: string,
  action: string,
  noAccessRoute: NoAccessRoute = 'noAccess',
) {
  return async (request: NextRequest, session: AppMiddlewareSession) => {
    if (!session) {
      return NextResponse.next();
    }
    if (!middlewareHasPermission(session, resource, action)) {
      return routes.redirect(request, routes.auth[noAccessRoute]);
    }
    return NextResponse.next();
  };
}

export const hasApplicationAccessMiddleware = requirePermissionMiddleware('application', 'access');
export const hasAnimalsAccessMiddleware = requirePermissionMiddleware('animals', 'access');
export const hasBankAccessMiddleware = requirePermissionMiddleware('bank', 'access');
export const hasMediaAccessMiddleware = requirePermissionMiddleware('media', 'access');
export const hasSpeciesManageMiddleware = requirePermissionMiddleware('species', 'manage');
