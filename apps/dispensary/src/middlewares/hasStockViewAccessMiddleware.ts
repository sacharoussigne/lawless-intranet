import { type NextRequest, NextResponse } from "next/server";
import { routes } from "@/types/routes";
import type { AppMiddlewareSession } from '@/types/middlewareSession';
import { getMiddlewareRole, middlewareHasPermission } from '@/types/middlewareSession';
import { userHasAccessibleChests } from '@/lib/chests/access';

export async function hasStockViewAccessMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.next();
  }

  if (!middlewareHasPermission(session, "stock", "view")) {
    return routes.redirect(request, routes.auth.noAccess);
  }

  const userRole = getMiddlewareRole(session);
  const dispensaryId = session.tenant?.dispensaryId;
  if (dispensaryId) {
    const hasChests = await userHasAccessibleChests(dispensaryId, userRole);
    if (!hasChests) {
      return routes.redirect(request, routes.auth.noAccess);
    }
  }

  return NextResponse.next();
}
