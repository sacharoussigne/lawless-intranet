import { type NextRequest, NextResponse } from "next/server";
import { routes } from "@/types/routes";
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { middlewareHasPermission } from '@/types/middlewareSession';

export async function hasPayrollReportsAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.next();
  }

  if (!middlewareHasPermission(session, "payroll_reports", "view")) {
    return routes.redirect(request, routes.auth.noManagementAccess);
  }

  return NextResponse.next();
}
