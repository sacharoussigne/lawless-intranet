import { type NextRequest, NextResponse } from "next/server";
import { routes } from "@/types/routes";
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { middlewareHasPermission } from '@/types/middlewareSession';

export async function hasSearchAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.next();
  }

  if (!middlewareHasPermission(session, "search", "access")) {
    return routes.redirect(request, routes.auth.noAccess);
  }

  return NextResponse.next();
}
