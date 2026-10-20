import { type NextRequest, NextResponse } from 'next/server';
import { routes, tenantRoutes } from '@/types/routes';
import { DEFAULT_BUSINESS_SLUG } from '@/lib/business/constants';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function hasToBeLoggedOutMiddleware(request: NextRequest, session: AppMiddlewareSession) {
    if (session) {
        return routes.redirect(request, tenantRoutes(DEFAULT_BUSINESS_SLUG).employee.index);
    }

    return NextResponse.next();
}