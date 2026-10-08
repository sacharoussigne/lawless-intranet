import { type NextRequest, NextResponse } from 'next/server';
import { routes } from '@/types/routes';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { middlewareHasPermission } from '@/types/middlewareSession';

type NoAccessRoute = 'noAccess' | 'noManagementAccess';

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
export const hasManagementAccessMiddleware = requirePermissionMiddleware('application', 'management', 'noManagementAccess');
export const hasBankAccessMiddleware = requirePermissionMiddleware('bank', 'access');
export const hasMailsAccessMiddleware = requirePermissionMiddleware('mails', 'access');
export const hasOrdersViewAccessMiddleware = requirePermissionMiddleware('orders', 'view');
export const hasPayrollReportsAccessMiddleware = requirePermissionMiddleware('payroll_reports', 'view', 'noManagementAccess');
export const hasSearchAccessMiddleware = requirePermissionMiddleware('search', 'access');
export const hasStockStatisticsAccessMiddleware = requirePermissionMiddleware('stock_statistics', 'view', 'noManagementAccess');
export const hasWeeklyDispensaryActivityMiddleware = requirePermissionMiddleware('weekly_dispensary_activity', 'view');
