import { type NextRequest, NextResponse } from 'next/server';
import { routes } from '@/types/routes';
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { parseShelterSlugFromPathname } from '@/lib/shelter/slug';
import { assertTenantAccessInMiddleware } from '@/lib/shelter/middlewareSession';
import { resolveShelterAccessDeniedRedirect } from '@/lib/shelter/context';

export async function hasTenantAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  const pathname = request.nextUrl.pathname;
  const slug = parseShelterSlugFromPathname(pathname);
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
    const target = await resolveShelterAccessDeniedRedirect(
      { user: session.user },
      pathname,
    );
    return routes.redirect(request, target);
  }
  return NextResponse.next();
}
