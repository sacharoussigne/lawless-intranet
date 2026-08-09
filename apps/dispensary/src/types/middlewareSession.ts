import type { NextRequest, NextResponse } from 'next/server';
import { can } from '@lawless-intranet/auth-permissions';

export type TenantMiddlewareContext = {
  dispensaryId: string;
  dispensarySlug: string;
  effectiveRole: string | null;
  effectivePermissions: string[];
};

export type AppMiddlewareSession = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  tenant?: TenantMiddlewareContext;
} | null;

export type AppMiddleware = (
  request: NextRequest,
  session: AppMiddlewareSession,
) => Promise<NextResponse>;

export function getMiddlewareRole(session: AppMiddlewareSession): string | null | undefined {
  if (session?.tenant) {
    return session.tenant.effectiveRole;
  }
  return session?.user?.role;
}

export function getMiddlewarePermissions(
  session: AppMiddlewareSession,
): string[] | null {
  return session?.tenant?.effectivePermissions ?? null;
}

export function middlewareHasPermission(
  session: AppMiddlewareSession,
  resource: string,
  action: string,
): boolean {
  const perms = getMiddlewarePermissions(session);
  if (perms) {
    return can(perms, resource, action);
  }
  return false;
}
