'use server';

import { cookies } from 'next/headers';
import { z } from 'zod/v3';
import { hasRole } from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { loggedAction } from '@/lib/logs/writer';
import { getRealAuthSession } from '@/lib/authSession';
import { requireBusinessFromSlug } from '@/lib/business/context';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { isMemberRoleAllowedForType } from '@/lib/businessTypes';
import { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE_S, serializeViewAsCookie } from '@/lib/business/viewAs';
import { Role } from '@/types/enum/roles';

const rolesSchema = z.array(z.string().min(1)).min(1, 'Choisissez au moins un rôle');

/** Starts or changes the « Voir en tant que » view; checked against the real rights (lib/business/viewAs). */
async function setViewAsUnlogged(businessSlug: string, input: unknown) {
  try {
    const session = await getRealAuthSession();
    if (!session?.user?.id) return { status: 401 as const, error: 'Non autorisé' };
    const business = await requireBusinessFromSlug(businessSlug);
    const roles = [...new Set(rolesSchema.parse(input))].sort();
    if (roles.some((role) => !isMemberRoleAllowedForType(business.type, role))) {
      return { status: 422 as const, error: 'Rôle invalide pour ce type d’entreprise' };
    }

    if (!isPlatformAdmin(session.user.role)) {
      const member = await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId: business.id, userId: session.user.id } },
        select: { role: true },
      });
      if (!hasRole(member?.role, Role.ADMIN)) {
        return { status: 403 as const, error: 'Droits administrateur requis' };
      }
    }

    (await cookies()).set(VIEW_AS_COOKIE, serializeViewAsCookie({ businessId: business.id, roles }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: VIEW_AS_MAX_AGE_S,
      secure: process.env.NODE_ENV === 'production',
    });
    return { status: 200 as const, data: { roles } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du changement de vue');
  }
}

/** Leaves the view: only needs a session, so it always works. */
async function stopViewAsUnlogged() {
  try {
    const session = await getRealAuthSession();
    if (!session?.user?.id) return { status: 401 as const, error: 'Non autorisé' };
    (await cookies()).delete(VIEW_AS_COOKIE);
    return { status: 200 as const };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la sortie de la vue');
  }
}

export async function setViewAs(...args: Parameters<typeof setViewAsUnlogged>) {
  return loggedAction({ feature: 'settings', event: 'viewAs.set' }, args, () => setViewAsUnlogged(...args));
}

export async function stopViewAs(...args: Parameters<typeof stopViewAsUnlogged>) {
  return loggedAction({ feature: 'settings', event: 'viewAs.stop' }, args, () => stopViewAsUnlogged(...args));
}
