import { type NextRequest, NextResponse } from "next/server";
import { checkRolePermission } from "@lawless-intranet/auth-permissions";
import { routes } from "@/types/routes";
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { getMiddlewareRole } from '@/types/middlewareSession';
import { userHasAccessibleChests } from '@/lib/chests/access';

export async function hasStockViewAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.next();
  }

  const userRole = getMiddlewareRole(session);
  const hasAccess = checkRolePermission(userRole, "stock", "view");

  if (!hasAccess) {
    return routes.redirect(request, routes.auth.noAccess);
  }

  const dispensaryId = session.tenant?.dispensaryId;
  if (dispensaryId) {
    const hasChests = await userHasAccessibleChests(dispensaryId, userRole);
    if (!hasChests) {
      return routes.redirect(request, routes.auth.noAccess);
    }
  }

  return NextResponse.next();
}
