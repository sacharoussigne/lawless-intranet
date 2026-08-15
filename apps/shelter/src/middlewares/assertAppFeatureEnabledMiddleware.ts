import { type NextRequest, NextResponse } from 'next/server';
import { isAppFeatureEnabled, loadAppSettingsFromDb, type AppFeatureKey } from '@/lib/appSettings';
import { routes } from '@/types/routes';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function assertAppFeatureEnabledMiddleware(
  request: NextRequest,
  session: AppMiddlewareSession,
  feature: AppFeatureKey,
): Promise<NextResponse> {
  const shelterId = session?.tenant?.shelterId;
  if (!shelterId) {
    return routes.redirect(request, routes.auth.noAccess);
  }
  const settings = await loadAppSettingsFromDb(shelterId);
  if (isAppFeatureEnabled(settings, feature)) {
    return NextResponse.next();
  }
  return routes.redirect(request, routes.auth.noAccess);
}
