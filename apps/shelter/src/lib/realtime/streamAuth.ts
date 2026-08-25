import { getRequestAuthSession } from '@/lib/authSession';
import { can } from '@/lib/shelter/permissionsCatalog';
import { requireShelterAccess } from '@/lib/shelter/context';

export async function requireShelterRealtimeStreamAccess(
  request: Request,
  shelterSlug: string,
): Promise<
  | { ok: true; shelterId: string; userId: string }
  | { ok: false; status: number; error: string }
> {
  const session = await getRequestAuthSession(request);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Non autorisé' };
  }

  try {
    const { shelter, effectivePermissions } = await requireShelterAccess(
      session,
      shelterSlug,
    );

    if (!can(effectivePermissions, 'waitlist', 'manage')) {
      return { ok: false, status: 403, error: 'Aucun flux temps réel autorisé' };
    }

    return {
      ok: true,
      shelterId: shelter.id,
      userId: session.user.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'SHELTER_NOT_FOUND') {
      return { ok: false, status: 404, error: 'Refuge introuvable' };
    }
    if (message === 'SHELTER_ACCESS_DENIED') {
      return { ok: false, status: 403, error: 'Accès refusé à ce refuge' };
    }
    throw error;
  }
}
