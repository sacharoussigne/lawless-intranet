import { type NextRequest, NextResponse } from 'next/server';
import { getAuthLoginRedirectUrl, getCallbackUrlFromRequest } from '@/lib/authSession';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function hasToBeLoggedInMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
) {
  if (!session) {
    return NextResponse.redirect(
      getAuthLoginRedirectUrl(getCallbackUrlFromRequest(request)),
    );
  }

  return NextResponse.next();
}
