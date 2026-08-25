'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v3';
import type { AnimalWaitRequestStatus } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { waitlistManageAuth } from '@/lib/animals/waitlistAuth';
import { emitWaitlistChange } from '@/lib/realtime/waitlist/broadcast';
import { tenantRoutes } from '@/types/routes';
import type {
  AnimalWaitRequestListItem,
  OpenWaitRequestsPreview,
} from '@/types/animalWaitRequests';

const dateOnlySchema = z.coerce.date();
const originClientIdSchema = z.string().trim().min(1).optional();

const createSchema = z.object({
  requestedAt: dateOnlySchema,
  requesterName: z.string().trim().min(1, 'Le demandeur est requis').max(255),
  speciesId: z.string().uuid('Espèce invalide'),
  breedId: z.string().uuid('Race invalide').nullable().optional(),
  comment: z.string().trim().max(5000).nullable().optional(),
  originClientId: originClientIdSchema,
});

const updateSchema = createSchema.extend({
  id: z.string().uuid('ID invalide'),
});

const statusSchema = z.object({
  id: z.string().uuid('ID invalide'),
  status: z.enum(['open', 'fulfilled', 'cancelled']),
  fulfilledAnimalId: z.string().uuid('Animal invalide').nullable().optional(),
  originClientId: originClientIdSchema,
});

const idSchema = z.object({
  id: z.string().uuid('ID invalide'),
  originClientId: originClientIdSchema,
});

function toDateOnlyIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function revalidateWaitlist(shelterSlug: string) {
  revalidatePath(tenantRoutes(shelterSlug).employee.waitlist);
}

function mapWaitRequest(row: {
  id: string;
  shelterId: string;
  requestedAt: Date;
  requesterName: string;
  speciesId: string;
  breedId: string | null;
  comment: string | null;
  status: AnimalWaitRequestStatus;
  fulfilledAnimalId: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  species: { name: string };
  breed: { name: string } | null;
  fulfilledAnimal: { name: string } | null;
}): AnimalWaitRequestListItem {
  return {
    id: row.id,
    shelterId: row.shelterId,
    requestedAt: toDateOnlyIso(row.requestedAt),
    requesterName: row.requesterName,
    speciesId: row.speciesId,
    speciesName: row.species.name,
    breedId: row.breedId,
    breedName: row.breed?.name ?? null,
    comment: row.comment,
    status: row.status,
    fulfilledAnimalId: row.fulfilledAnimalId,
    fulfilledAnimalName: row.fulfilledAnimal?.name ?? null,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const waitRequestInclude = {
  species: { select: { name: true } },
  breed: { select: { name: true } },
  fulfilledAnimal: { select: { name: true } },
} as const;

async function assertSpeciesAndBreed(
  shelterId: string,
  speciesId: string,
  breedId: string | null | undefined,
) {
  const species = await prisma.animalSpecies.findFirst({
    where: { id: speciesId, shelterId },
    select: { id: true },
  });
  if (!species) {
    throw new Error('Espèce introuvable pour ce refuge');
  }

  if (!breedId) return null;

  const breed = await prisma.animalBreed.findFirst({
    where: { id: breedId, speciesId },
    select: { id: true },
  });
  if (!breed) {
    throw new Error('La race doit appartenir à l’espèce sélectionnée');
  }
  return breed.id;
}

export async function listAnimalWaitRequests(
  shelterSlug: string,
  filters?: { status?: AnimalWaitRequestStatus | null },
) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const rows = await prisma.animalWaitRequest.findMany({
      where: {
        shelterId: auth.tenant.shelterId,
        ...(filters?.status ? { status: filters.status } : {}),
      },
      include: waitRequestInclude,
      orderBy: [{ requestedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return { status: 200, data: rows.map(mapWaitRequest) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de la file d’attente');
  }
}

export async function listOpenWaitRequestsPreview(
  shelterSlug: string,
): Promise<{ status: number; data?: OpenWaitRequestsPreview; error?: unknown }> {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const shelterId = auth.tenant.shelterId;
    const where = { shelterId, status: 'open' as const };

    const [count, rows] = await Promise.all([
      prisma.animalWaitRequest.count({ where }),
      prisma.animalWaitRequest.findMany({
        where,
        include: {
          species: { select: { name: true } },
          breed: { select: { name: true } },
        },
        orderBy: [{ requestedAt: 'asc' }, { createdAt: 'asc' }],
        take: 3,
      }),
    ]);

    return {
      status: 200,
      data: {
        count,
        items: rows.map((row) => ({
          id: row.id,
          requestedAt: toDateOnlyIso(row.requestedAt),
          requesterName: row.requesterName,
          speciesName: row.species.name,
          breedName: row.breed?.name ?? null,
        })),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de l’aperçu file d’attente');
  }
}

export async function listWaitlistSpeciesOptions(shelterSlug: string) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const rows = await prisma.animalSpecies.findMany({
      where: { shelterId: auth.tenant.shelterId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        breeds: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true },
        },
      },
    });

    return {
      status: 200,
      data: rows.map((species) => ({
        id: species.id,
        name: species.name,
        breeds: species.breeds,
      })),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des espèces');
  }
}

export async function listAnimalsForWaitlistLink(shelterSlug: string) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const rows = await prisma.animal.findMany({
      where: {
        shelterId: auth.tenant.shelterId,
        status: { in: ['in_care', 'awaiting_adoption'] },
      },
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        species: { select: { name: true } },
        breed: { select: { name: true } },
      },
    });

    return {
      status: 200,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        label: `${row.name} · ${row.species.name} / ${row.breed.name}`,
      })),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des animaux');
  }
}

export async function createAnimalWaitRequest(
  shelterSlug: string,
  data: z.infer<typeof createSchema>,
) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const parsed = createSchema.parse(data);
    const breedId = await assertSpeciesAndBreed(
      auth.tenant.shelterId,
      parsed.speciesId,
      parsed.breedId,
    );

    const row = await prisma.animalWaitRequest.create({
      data: {
        shelterId: auth.tenant.shelterId,
        requestedAt: parsed.requestedAt,
        requesterName: parsed.requesterName,
        speciesId: parsed.speciesId,
        breedId,
        comment: parsed.comment?.trim() ? parsed.comment.trim() : null,
        createdByUserId: auth.session.user.id,
      },
      include: waitRequestInclude,
    });

    revalidateWaitlist(shelterSlug);
    await emitWaitlistChange(auth.tenant.shelterId, {}, {
      originClientId: parsed.originClientId,
    });
    return { status: 200, data: mapWaitRequest(row) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la demande');
  }
}

export async function updateAnimalWaitRequest(
  shelterSlug: string,
  data: z.infer<typeof updateSchema>,
) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const parsed = updateSchema.parse(data);
    const existing = await prisma.animalWaitRequest.findFirst({
      where: { id: parsed.id, shelterId: auth.tenant.shelterId },
      select: { id: true, status: true },
    });
    if (!existing) {
      return { status: 404, error: 'Demande introuvable' };
    }

    const breedId = await assertSpeciesAndBreed(
      auth.tenant.shelterId,
      parsed.speciesId,
      parsed.breedId,
    );

    const row = await prisma.animalWaitRequest.update({
      where: { id: existing.id },
      data: {
        requestedAt: parsed.requestedAt,
        requesterName: parsed.requesterName,
        speciesId: parsed.speciesId,
        breedId,
        comment: parsed.comment?.trim() ? parsed.comment.trim() : null,
      },
      include: waitRequestInclude,
    });

    revalidateWaitlist(shelterSlug);
    await emitWaitlistChange(auth.tenant.shelterId, {}, {
      originClientId: parsed.originClientId,
    });
    return { status: 200, data: mapWaitRequest(row) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la demande');
  }
}

export async function setAnimalWaitRequestStatus(
  shelterSlug: string,
  data: z.infer<typeof statusSchema>,
) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const parsed = statusSchema.parse(data);
    const existing = await prisma.animalWaitRequest.findFirst({
      where: { id: parsed.id, shelterId: auth.tenant.shelterId },
      select: { id: true },
    });
    if (!existing) {
      return { status: 404, error: 'Demande introuvable' };
    }

    let fulfilledAnimalId: string | null = null;
    if (parsed.status === 'fulfilled') {
      fulfilledAnimalId = parsed.fulfilledAnimalId ?? null;
      if (fulfilledAnimalId) {
        const animal = await prisma.animal.findFirst({
          where: { id: fulfilledAnimalId, shelterId: auth.tenant.shelterId },
          select: { id: true },
        });
        if (!animal) {
          return { status: 404, error: 'Animal introuvable pour ce refuge' };
        }
      }
    }

    const row = await prisma.animalWaitRequest.update({
      where: { id: existing.id },
      data: {
        status: parsed.status,
        fulfilledAnimalId: parsed.status === 'fulfilled' ? fulfilledAnimalId : null,
      },
      include: waitRequestInclude,
    });

    revalidateWaitlist(shelterSlug);
    await emitWaitlistChange(auth.tenant.shelterId, {}, {
      originClientId: parsed.originClientId,
    });
    return { status: 200, data: mapWaitRequest(row) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du changement de statut');
  }
}

export async function deleteAnimalWaitRequest(
  shelterSlug: string,
  data: z.infer<typeof idSchema>,
) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
    if (!auth.ok) return auth.response;

    const parsed = idSchema.parse(data);
    const existing = await prisma.animalWaitRequest.findFirst({
      where: { id: parsed.id, shelterId: auth.tenant.shelterId },
      select: { id: true },
    });
    if (!existing) {
      return { status: 404, error: 'Demande introuvable' };
    }

    await prisma.animalWaitRequest.delete({ where: { id: existing.id } });
    revalidateWaitlist(shelterSlug);
    await emitWaitlistChange(auth.tenant.shelterId, {}, {
      originClientId: parsed.originClientId,
    });
    return { status: 200, data: { id: existing.id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la demande');
  }
}
