import { type NextRequest, NextResponse } from 'next/server';
import { routes, tenantRoutes } from '@/types/routes';
import { DEFAULT_DISPENSARY_SLUG } from '@/lib/dispensary/constants';
import type { AppMiddlewareSession } from '@/types/middlewareSession';

export async function hasToBeLoggedOutMiddleware(request: NextRequest, session: AppMiddlewareSession) {
    if (session) {
        return routes.redirect(request, tenantRoutes(DEFAULT_DISPENSARY_SLUG).employee.index);
    }

    return NextResponse.next();
}