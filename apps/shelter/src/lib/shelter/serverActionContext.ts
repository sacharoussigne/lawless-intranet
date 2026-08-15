'use server';

import { getAuthSession } from '@/lib/authSession';
import {
  requireShelterAccess,
  requireShelterFromSlug,
  type ShelterContext,
} from '@/lib/shelter/context';
import { isPlatformAdmin } from '@/lib/shelter/platformAdmin';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';

export type TenantActionContext = {
  shelter: ShelterContext;
  shelterId: string;
  effectiveRole: string | null;
  effectivePermissions: string[];
  userId: string;
};

export async function requireTenantActionContext(
  shelterSlug: string,
): Promise<
  | { ok: true; ctx: TenantActionContext }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Non autorisé' };
  }

  try {
    const { shelter, effectiveRole, effectivePermissions } = await requireShelterAccess(
      session,
      shelterSlug,
    );
    return {
      ok: true,
      ctx: {
        shelter,
        shelterId: shelter.id,
        effectiveRole,
        effectivePermissions,
        userId: session.user.id,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message === 'SHELTER_NOT_FOUND') {
      return { ok: false, status: 404, error: 'Refuge introuvable' };
    }
    if (message === 'SHELTER_ACCESS_DENIED') {
      return { ok: false, status: 403, error: 'Accès refusé à ce refuge' };
    }
    throw e;
  }
}

export async function requireShelterAdminContext(
  shelterSlug: string,
): Promise<
  | { ok: true; ctx: TenantActionContext }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const base = await requireTenantActionContext(shelterSlug);
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

export async function resolveShelterIdBySlug(slug: string): Promise<string | null> {
  try {
    const s = await requireShelterFromSlug(slug);
    return s.id;
  } catch {
    return null;
  }
}
