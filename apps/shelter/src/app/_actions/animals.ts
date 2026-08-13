'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v3';
import { Prisma, type AnimalStatus } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import {
  requireEffectivePermission,
  requireTenantServerActionContext,
} from '@/lib/serverActionAuth';
import {
  animalsAccessAuth,
  animalsCreateAuth,
  animalsDeleteAuth,
} from '@/lib/animals/auth';
import { can } from '@/lib/shelter/permissionsCatalog';
import { tenantRoutes } from '@/types/routes';
import { attachUserProfiles, fetchUserProfiles } from '@/lib/authUsers';

const moneySchema = z
  .number({ invalid_type_error: 'Prix invalide' })
  .finite('Prix invalide')
  .min(0, 'Le prix doit être positif ou nul')
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8,
    'Deux décimales maximum',
  );

const nameSchema = z.string().trim().min(1, 'Le nom est requis').max(120);

const statusSchema = z.enum(['in_care', 'awaiting_adoption', 'adopted', 'deceased']);

const dateOnlySchema = z.coerce.date();

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

function toDateOnlyIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function revalidateAnimals(shelterSlug: string, animalId?: string) {
  const t = tenantRoutes(shelterSlug);
  revalidatePath(t.employee.animals);
  if (animalId) revalidatePath(t.employee.animal(animalId));
}

const animalInclude = {
  species: { select: { id: true, name: true } },
  breed: {
    select: {
      id: true,
      name: true,
      shelterPurchasePrice: true,
      animalierPurchasePrice: true,
    },
  },
  variant: { select: { id: true, label: true } },
} as const;

function serializeAnimal<
  T extends {
    adoptionPrice: Prisma.Decimal;
    arrivalDate: Date;
    departureDate: Date | null;
    breed: {
      shelterPurchasePrice: Prisma.Decimal | null;
      animalierPurchasePrice: Prisma.Decimal | null;
    };
  },
>(row: T) {
  return {
    ...row,
    adoptionPrice: Number(row.adoptionPrice.toString()),
    arrivalDate: toDateOnlyIso(row.arrivalDate),
    departureDate: row.departureDate ? toDateOnlyIso(row.departureDate) : null,
    breed: {
      ...row.breed,
      shelterPurchasePrice: decimalToNumber(row.breed.shelterPurchasePrice),
      animalierPurchasePrice: decimalToNumber(row.breed.animalierPurchasePrice),
    },
  };
}

function animalSnapshot(row: {
  name: string;
  speciesId: string;
  breedId: string;
  variantId: string | null;
  arrivalDate: Date;
  adoptionPrice: Prisma.Decimal;
  caseManagerUserId: string;
  status: AnimalStatus;
  biography: string | null;
  careProvided: string | null;
  notes: string | null;
  adopterName: string | null;
  departureDate: Date | null;
}) {
  return {
    name: row.name,
    speciesId: row.speciesId,
    breedId: row.breedId,
    variantId: row.variantId,
    arrivalDate: toDateOnlyIso(row.arrivalDate),
    adoptionPrice: Number(row.adoptionPrice.toString()),
    caseManagerUserId: row.caseManagerUserId,
    status: row.status,
    biography: row.biography,
    careProvided: row.careProvided,
    notes: row.notes,
    adopterName: row.adopterName,
    departureDate: row.departureDate ? toDateOnlyIso(row.departureDate) : null,
  };
}

async function requireAnimalInShelter(shelterId: string, animalId: string) {
  return prisma.animal.findFirst({
    where: { id: animalId, shelterId },
    include: animalInclude,
  });
}

export async function listSpeciesOptions(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const rows = await prisma.animalSpecies.findMany({
      where: { shelterId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        breeds: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: {
            variants: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] },
          },
        },
      },
    });

    return {
      status: 200,
      data: rows.map((species) => ({
        id: species.id,
        name: species.name,
        breeds: species.breeds.map((breed) => ({
          id: breed.id,
          name: breed.name,
          shelterPurchasePrice: decimalToNumber(breed.shelterPurchasePrice),
          animalierPurchasePrice: decimalToNumber(breed.animalierPurchasePrice),
          variants: breed.variants.map((v) => ({ id: v.id, label: v.label })),
        })),
      })),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des espèces');
  }
}

export async function listCaseManagerOptions(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const members = await prisma.shelterMember.findMany({
      where: { shelterId },
      orderBy: { createdAt: 'asc' },
    });
    const usersById = await fetchUserProfiles(members.map((m) => m.userId));
    const enriched = attachUserProfiles(members, usersById)
      .map((m) => ({
        userId: m.userId,
        name: m.user?.name ?? m.userId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    return { status: 200, data: enriched };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des responsables');
  }
}

export async function listAnimals(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const rows = await prisma.animal.findMany({
      where: { shelterId },
      orderBy: [{ arrivalDate: 'desc' }, { name: 'asc' }],
      include: animalInclude,
    });

    const managers = await fetchUserProfiles(rows.map((r) => r.caseManagerUserId));
    const data = rows.map((row) => {
      const serialized = serializeAnimal(row);
      return {
        ...serialized,
        caseManagerName: managers.get(row.caseManagerUserId)?.name ?? row.caseManagerUserId,
      };
    });

    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des animaux');
  }
}

export async function getAnimal(shelterSlug: string, animalId: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(animalId);

    const row = await requireAnimalInShelter(shelterId, id);
    if (!row) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const managers = await fetchUserProfiles([row.caseManagerUserId]);
    return {
      status: 200,
      data: {
        ...serializeAnimal(row),
        caseManagerName: managers.get(row.caseManagerUserId)?.name ?? row.caseManagerUserId,
      },
    };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors du chargement de l'animal");
  }
}

export async function createAnimal(
  shelterSlug: string,
  data: {
    name: string;
    speciesId: string;
    breedId: string;
    variantId?: string | null;
    arrivalDate: string | Date;
    adoptionPrice: number;
    caseManagerUserId: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsCreateAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const name = nameSchema.parse(data.name);
    const speciesId = z.string().uuid().parse(data.speciesId);
    const breedId = z.string().uuid().parse(data.breedId);
    const variantId =
      data.variantId == null || data.variantId === ''
        ? null
        : z.string().uuid().parse(data.variantId);
    const arrivalDate = dateOnlySchema.parse(data.arrivalDate);
    const adoptionPrice = moneySchema.parse(data.adoptionPrice);
    const caseManagerUserId = z.string().min(1).parse(data.caseManagerUserId);

    const breed = await prisma.animalBreed.findFirst({
      where: { id: breedId, speciesId, species: { shelterId } },
      select: { id: true, speciesId: true },
    });
    if (!breed) {
      return { status: 400, error: 'Race invalide pour cette espèce' };
    }

    if (variantId) {
      const variant = await prisma.animalSpeciesVariant.findFirst({
        where: { id: variantId, breedId },
        select: { id: true },
      });
      if (!variant) {
        return { status: 400, error: 'Variante invalide pour cette race' };
      }
    }

    const member = await prisma.shelterMember.findFirst({
      where: { shelterId, userId: caseManagerUserId },
      select: { id: true },
    });
    if (!member) {
      return { status: 400, error: 'Le responsable doit être membre du refuge' };
    }

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.animal.create({
        data: {
          shelterId,
          name,
          speciesId,
          breedId,
          variantId,
          arrivalDate,
          adoptionPrice,
          caseManagerUserId,
          status: 'awaiting_adoption',
        },
        include: animalInclude,
      });

      await tx.animalHistory.create({
        data: {
          animalId: created.id,
          shelterId,
          action: 'create',
          actorUserId: ctx.session.user.id,
          previousValues: Prisma.JsonNull,
          nextValues: animalSnapshot(created) as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    revalidateAnimals(shelterSlug, row.id);
    const managers = await fetchUserProfiles([row.caseManagerUserId]);
    return {
      status: 201,
      data: {
        ...serializeAnimal(row),
        caseManagerName: managers.get(row.caseManagerUserId)?.name ?? row.caseManagerUserId,
      },
    };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la création de l'animal");
  }
}

export async function updateAnimal(
  shelterSlug: string,
  data: {
    id: string;
    name?: string;
    speciesId?: string;
    breedId?: string;
    variantId?: string | null;
    arrivalDate?: string | Date;
    adoptionPrice?: number;
    caseManagerUserId?: string;
    status?: AnimalStatus;
    biography?: string | null;
    careProvided?: string | null;
    notes?: string | null;
    adopterName?: string | null;
    departureDate?: string | Date | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId, effectivePermissions } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);

    const existing = await requireAnimalInShelter(shelterId, id);
    if (!existing) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const coreTouched =
      data.name !== undefined ||
      data.speciesId !== undefined ||
      data.breedId !== undefined ||
      data.variantId !== undefined ||
      data.arrivalDate !== undefined ||
      data.adoptionPrice !== undefined ||
      data.caseManagerUserId !== undefined;

    const softTouched =
      data.status !== undefined ||
      data.biography !== undefined ||
      data.careProvided !== undefined ||
      data.notes !== undefined ||
      data.adopterName !== undefined ||
      data.departureDate !== undefined;

    if (coreTouched) {
      const perm = requireEffectivePermission(
        effectivePermissions,
        'animals',
        'updateCore',
        'Permission refusée pour les champs principaux',
      );
      if (!perm.ok) return perm.response;
    }

    if (softTouched) {
      const perm = requireEffectivePermission(
        effectivePermissions,
        'animals',
        'update',
        "Permission refusée pour l'édition de l'animal",
      );
      if (!perm.ok) return perm.response;
    }

    if (!coreTouched && !softTouched) {
      return { status: 400, error: 'Aucune modification' };
    }

    const updateData: Prisma.AnimalUpdateInput = {};

    if (data.name !== undefined) updateData.name = nameSchema.parse(data.name);

    const nextSpeciesId =
      data.speciesId !== undefined ? z.string().uuid().parse(data.speciesId) : existing.speciesId;
    const nextBreedId =
      data.breedId !== undefined ? z.string().uuid().parse(data.breedId) : existing.breedId;
    const nextVariantId =
      data.variantId === undefined
        ? existing.variantId
        : data.variantId === null || data.variantId === ''
          ? null
          : z.string().uuid().parse(data.variantId);

    if (
      data.speciesId !== undefined ||
      data.breedId !== undefined ||
      data.variantId !== undefined
    ) {
      const breed = await prisma.animalBreed.findFirst({
        where: { id: nextBreedId, speciesId: nextSpeciesId, species: { shelterId } },
        select: { id: true },
      });
      if (!breed) {
        return { status: 400, error: 'Race invalide pour cette espèce' };
      }
      if (nextVariantId) {
        const variant = await prisma.animalSpeciesVariant.findFirst({
          where: { id: nextVariantId, breedId: nextBreedId },
          select: { id: true },
        });
        if (!variant) {
          return { status: 400, error: 'Variante invalide pour cette race' };
        }
      }
      updateData.species = { connect: { id: nextSpeciesId } };
      updateData.breed = { connect: { id: nextBreedId } };
      updateData.variant = nextVariantId
        ? { connect: { id: nextVariantId } }
        : { disconnect: true };
    }

    if (data.arrivalDate !== undefined) {
      updateData.arrivalDate = dateOnlySchema.parse(data.arrivalDate);
    }
    if (data.adoptionPrice !== undefined) {
      updateData.adoptionPrice = moneySchema.parse(data.adoptionPrice);
    }
    if (data.caseManagerUserId !== undefined) {
      const caseManagerUserId = z.string().min(1).parse(data.caseManagerUserId);
      const member = await prisma.shelterMember.findFirst({
        where: { shelterId, userId: caseManagerUserId },
        select: { id: true },
      });
      if (!member) {
        return { status: 400, error: 'Le responsable doit être membre du refuge' };
      }
      updateData.caseManagerUserId = caseManagerUserId;
    }

    if (data.status !== undefined) updateData.status = statusSchema.parse(data.status);
    if (data.biography !== undefined) {
      updateData.biography =
        data.biography == null || data.biography.trim() === '' ? null : data.biography.trim();
    }
    if (data.careProvided !== undefined) {
      updateData.careProvided =
        data.careProvided == null || data.careProvided.trim() === ''
          ? null
          : data.careProvided.trim();
    }
    if (data.notes !== undefined) {
      updateData.notes =
        data.notes == null || data.notes.trim() === '' ? null : data.notes.trim();
    }
    if (data.adopterName !== undefined) {
      updateData.adopterName =
        data.adopterName == null || data.adopterName.trim() === ''
          ? null
          : data.adopterName.trim();
    }
    if (data.departureDate !== undefined) {
      updateData.departureDate =
        data.departureDate == null || data.departureDate === ''
          ? null
          : dateOnlySchema.parse(data.departureDate);
    }

    const previous = animalSnapshot(existing);

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.animal.update({
        where: { id },
        data: updateData,
        include: animalInclude,
      });

      await tx.animalHistory.create({
        data: {
          animalId: updated.id,
          shelterId,
          action: 'update',
          actorUserId: ctx.session.user.id,
          previousValues: previous as Prisma.InputJsonValue,
          nextValues: animalSnapshot(updated) as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    revalidateAnimals(shelterSlug, row.id);
    const managers = await fetchUserProfiles([row.caseManagerUserId]);
    return {
      status: 200,
      data: {
        ...serializeAnimal(row),
        caseManagerName: managers.get(row.caseManagerUserId)?.name ?? row.caseManagerUserId,
      },
    };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la modification de l'animal");
  }
}

export async function deleteAnimal(shelterSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsDeleteAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);

    const existing = await requireAnimalInShelter(shelterId, id);
    if (!existing) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const previous = animalSnapshot(existing);

    await prisma.$transaction(async (tx) => {
      await tx.animalHistory.create({
        data: {
          animalId: id,
          shelterId,
          action: 'delete',
          actorUserId: ctx.session.user.id,
          previousValues: previous as Prisma.InputJsonValue,
          nextValues: Prisma.JsonNull,
        },
      });
      await tx.animal.delete({ where: { id } });
    });

    revalidateAnimals(shelterSlug);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la suppression de l'animal");
  }
}

export async function listAnimalHistory(shelterSlug: string, animalId: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(animalId);

    const animal = await prisma.animal.findFirst({
      where: { id, shelterId },
      select: { id: true },
    });
    if (!animal) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const rows = await prisma.animalHistory.findMany({
      where: { shelterId, animalId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const actors = await fetchUserProfiles(
      rows.map((r) => r.actorUserId).filter((v): v is string => Boolean(v)),
    );

    return {
      status: 200,
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        actorUserId: row.actorUserId,
        actorName: row.actorUserId
          ? (actors.get(row.actorUserId)?.name ?? row.actorUserId)
          : null,
        previousValues: row.previousValues,
        nextValues: row.nextValues,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors du chargement de l'historique");
  }
}

export async function canEditAnimalFlags(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const perms = ctx.tenant.effectivePermissions;
    return {
      status: 200,
      data: {
        canCreate: can(perms, 'animals', 'create'),
        canUpdate: can(perms, 'animals', 'update'),
        canUpdateCore: can(perms, 'animals', 'updateCore'),
        canDelete: can(perms, 'animals', 'delete'),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur permissions');
  }
}
