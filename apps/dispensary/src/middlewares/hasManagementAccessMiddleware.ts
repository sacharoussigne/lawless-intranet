import { type NextRequest, NextResponse } from "next/server";
import { routes } from "@/types/routes";
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { middlewareHasPermission } from '@/types/middlewareSession';

export async function hasManagementAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.next();
  }

  if (!middlewareHasPermission(session, "application", "management")) {
    return routes.redirect(request, routes.auth.noManagementAccess);
  }

  return NextResponse.next();
}
