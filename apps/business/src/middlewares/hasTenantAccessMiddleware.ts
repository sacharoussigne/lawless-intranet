import { type NextRequest, NextResponse } from 'next/server';
import { routes } from '@/types/routes';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { parseBusinessSlugFromPathname } from '@/lib/business/slug';
import { assertTenantAccessInMiddleware } from '@/lib/business/middlewareSession';
import { resolveBusinessAccessDeniedRedirect } from '@/lib/business/context';

export async function hasTenantAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  const pathname = request.nextUrl.pathname;
  const slug = parseBusinessSlugFromPathname(pathname);
  if (!slug) {
    return NextResponse.next();
  }
  if (!session) {
    return NextResponse.next();
  }
  if (!session.tenant) {
    return NextResponse.next();
  }
  const allowed = await assertTenantAccessInMiddleware(session);
  if (!allowed) {
    const target = await resolveBusinessAccessDeniedRedirect(
      { user: session.user },
      pathname,
    );
    return routes.redirect(request, target);
  }
  return NextResponse.next();
}
