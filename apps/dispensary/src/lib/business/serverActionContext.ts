'use server';

import { getAuthSession, type AuthSession } from '@/lib/authSession';
import {
  requireBusinessAccess,
  requireBusinessFromSlug,
  type BusinessContext,
} from '@/lib/business/context';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';

export type TenantActionContext = {
  business: BusinessContext;
  businessId: string;
  effectiveRole: string | null;
  effectivePermissions: string[];
  userId: string;
};

export async function requireTenantActionContext(
  businessSlug: string,
): Promise<
  | { ok: true; ctx: TenantActionContext; session: AuthSession }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Non autorisé' };
  }

  try {
    const { business, effectiveRole, effectivePermissions } = await requireBusinessAccess(
      session,
      businessSlug,
    );
    return {
      ok: true,
      ctx: {
        business,
        businessId: business.id,
        effectiveRole,
        effectivePermissions,
        userId: session.user.id,
      },
      session,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'DISPENSARY_NOT_FOUND') {
      return { ok: false, status: 404, error: 'Dispensaire introuvable' };
    }
    if (message === 'DISPENSARY_ACCESS_DENIED') {
      return { ok: false, status: 403, error: 'Accès refusé à ce dispensaire' };
    }
    throw e;
  }
}

export async function requireBusinessAdminContext(
  businessSlug: string,
): Promise<
  | { ok: true; ctx: TenantActionContext }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const base = await requireTenantActionContext(businessSlug);
  if (!base.ok) {
    return base;
  }
  const session = await getAuthSession();
  const platform = isPlatformAdmin(session?.user?.role);
  const tenantAdmin = hasRole(base.ctx.effectiveRole, Role.ADMIN);
  if (!platform && !tenantAdmin) {
    return { ok: false, status: 403, error: 'Droits administrateur requis' };
  }
  return base;
}

export async function requirePlatformAdminContext(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Non autorisé' };
  }
  if (!isPlatformAdmin(session.user.role)) {
    return { ok: false, status: 403, error: 'Droits super-admin requis' };
  }
  return { ok: true, userId: session.user.id };
}

export async function resolveBusinessIdBySlug(slug: string): Promise<string | null> {
  try {
    const d = await requireBusinessFromSlug(slug);
    return d.id;
  } catch {
    return null;
  }
}
