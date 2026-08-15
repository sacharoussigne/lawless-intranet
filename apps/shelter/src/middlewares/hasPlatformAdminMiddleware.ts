import { type NextRequest, NextResponse } from 'next/server';
import { routes } from '@/types/routes';
import { isPlatformAdmin } from '@/lib/shelter/platformAdmin';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { getAuthLoginRedirectUrl, getCallbackUrlFromRequest } from '@/lib/authSession';

export async function hasPlatformAdminMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.redirect(
      getAuthLoginRedirectUrl(getCallbackUrlFromRequest(request)),
    );
  }
  if (!isPlatformAdmin(session.user?.role)) {
    return routes.redirect(request, routes.auth.noManagementAccess);
  }
  return NextResponse.next();
}
