'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v3';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { speciesActionAuth } from '@/lib/species/auth';
import { tenantRoutes } from '@/types/routes';

const speciesNameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom est requis')
  .max(120, 'Le nom est trop long');

const variantLabelSchema = z
  .string()
  .trim()
  .min(1, 'Le libellé est requis')
  .max(255, 'Le libellé est trop long');

const reorderItemSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number().int().min(0),
});

const reorderItemsSchema = z.object({
  items: z.array(reorderItemSchema).min(1),
});

const moneySchema = z
  .number({ invalid_type_error: 'Prix invalide' })
  .finite('Prix invalide')
  .min(0, 'Le prix doit être positif ou nul')
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8,
    'Deux décimales maximum',
  );

const speciesInclude = {
  breeds: {
    orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }],
    include: {
      variants: { orderBy: [{ sortOrder: 'asc' as const }, { label: 'asc' as const }] },
    },
  },
};

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value == null) return null;
  return Number(value.toString());
}

type WithPurchasePrices = {
  shelterPurchasePrice: Prisma.Decimal | null;
  animalierPurchasePrice: Prisma.Decimal | null;
};

type SerializedPurchasePrices = {
  shelterPurchasePrice: number | null;
  animalierPurchasePrice: number | null;
};

function serializeBreed<T extends WithPurchasePrices>(
  row: T,
): Omit<T, 'shelterPurchasePrice' | 'animalierPurchasePrice'> & SerializedPurchasePrices {
  return {
    ...row,
    shelterPurchasePrice: decimalToNumber(row.shelterPurchasePrice),
    animalierPurchasePrice: decimalToNumber(row.animalierPurchasePrice),
  };
}

function serializeSpecies<T extends { breeds: WithPurchasePrices[] }>(
  row: T,
): Omit<T, 'breeds'> & {
  breeds: Array<
    Omit<T['breeds'][number], 'shelterPurchasePrice' | 'animalierPurchasePrice'> &
      SerializedPurchasePrices
  >;
} {
  return {
    ...row,
    breeds: row.breeds.map(serializeBreed),
  };
}

function uniqueConflictMessage(fallback: string, error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return fallback;
  }
  throw error;
}

async function requireSpeciesInShelter(shelterId: string, speciesId: string) {
  return prisma.animalSpecies.findFirst({
    where: { id: speciesId, shelterId },
    select: { id: true, shelterId: true, name: true },
  });
}

async function requireBreedInShelter(shelterId: string, breedId: string) {
  return prisma.animalBreed.findFirst({
    where: { id: breedId, species: { shelterId } },
    select: { id: true, speciesId: true, name: true },
  });
}

function revalidateSpecies(shelterSlug: string) {
  revalidatePath(tenantRoutes(shelterSlug).employee.species);
}

export async function listSpecies(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const rows = await prisma.animalSpecies.findMany({
      where: { shelterId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: speciesInclude,
    });

    return { status: 200, data: rows.map(serializeSpecies) };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des espèces');
  }
}

export async function createSpecies(shelterSlug: string, data: { name: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const name = speciesNameSchema.parse(data.name);

    const maxOrder = await prisma.animalSpecies.aggregate({
      where: { shelterId },
      _max: { sortOrder: true },
    });

    try {
      const row = await prisma.animalSpecies.create({
        data: {
          shelterId,
          name,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
        include: speciesInclude,
      });
      revalidateSpecies(shelterSlug);
      return { status: 201, data: serializeSpecies(row) };
    } catch (error) {
      return {
        status: 409,
        error: uniqueConflictMessage('Une espèce avec ce nom existe déjà', error),
      };
    }
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la création de l'espèce");
  }
}

export async function updateSpecies(
  shelterSlug: string,
  data: { id: string; name: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);
    const name = speciesNameSchema.parse(data.name);

    const existing = await requireSpeciesInShelter(shelterId, id);
    if (!existing) {
      return { status: 404, error: 'Espèce introuvable' };
    }

    try {
      const row = await prisma.animalSpecies.update({
        where: { id },
        data: { name },
        include: speciesInclude,
      });
      revalidateSpecies(shelterSlug);
      return { status: 200, data: serializeSpecies(row) };
    } catch (error) {
      return {
        status: 409,
        error: uniqueConflictMessage('Une espèce avec ce nom existe déjà', error),
      };
    }
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la modification de l'espèce");
  }
}

export async function deleteSpecies(shelterSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);

    const existing = await requireSpeciesInShelter(shelterId, id);
    if (!existing) {
      return { status: 404, error: 'Espèce introuvable' };
    }

    await prisma.animalSpecies.delete({ where: { id } });
    revalidateSpecies(shelterSlug);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de la suppression de l'espèce");
  }
}

export async function createBreed(
  shelterSlug: string,
  data: { speciesId: string; name: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const speciesId = z.string().uuid().parse(data.speciesId);
    const name = speciesNameSchema.parse(data.name);

    const species = await requireSpeciesInShelter(shelterId, speciesId);
    if (!species) {
      return { status: 404, error: 'Espèce introuvable' };
    }

    const maxOrder = await prisma.animalBreed.aggregate({
      where: { speciesId },
      _max: { sortOrder: true },
    });

    try {
      const row = await prisma.animalBreed.create({
        data: {
          speciesId,
          name,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
        include: {
          variants: true,
        },
      });
      revalidateSpecies(shelterSlug);
      return { status: 201, data: serializeBreed(row) };
    } catch (error) {
      return {
        status: 409,
        error: uniqueConflictMessage('Une race avec ce nom existe déjà', error),
      };
    }
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la race');
  }
}

export async function updateBreed(
  shelterSlug: string,
  data: {
    id: string;
    name: string;
    shelterPurchasePrice?: number;
    animalierPurchasePrice?: number | null;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);
    const name = speciesNameSchema.parse(data.name);

    const updatingPrices =
      data.shelterPurchasePrice !== undefined || data.animalierPurchasePrice !== undefined;

    let shelterPurchasePrice: number | undefined;
    let animalierPurchasePrice: number | null | undefined;

    if (updatingPrices) {
      shelterPurchasePrice = moneySchema.parse(data.shelterPurchasePrice);
      if (data.animalierPurchasePrice === undefined) {
        animalierPurchasePrice = null;
      } else if (data.animalierPurchasePrice === null) {
        animalierPurchasePrice = null;
      } else {
        animalierPurchasePrice = moneySchema.parse(data.animalierPurchasePrice);
      }
    }

    const existing = await requireBreedInShelter(shelterId, id);
    if (!existing) {
      return { status: 404, error: 'Race introuvable' };
    }

    try {
      const row = await prisma.animalBreed.update({
        where: { id },
        data: {
          name,
          ...(updatingPrices
            ? {
                shelterPurchasePrice,
                animalierPurchasePrice,
              }
            : {}),
        },
        include: {
          variants: { orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] },
        },
      });
      revalidateSpecies(shelterSlug);
      return { status: 200, data: serializeBreed(row) };
    } catch (error) {
      return {
        status: 409,
        error: uniqueConflictMessage('Une race avec ce nom existe déjà', error),
      };
    }
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification de la race');
  }
}

export async function deleteBreed(shelterSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);

    const existing = await requireBreedInShelter(shelterId, id);
    if (!existing) {
      return { status: 404, error: 'Race introuvable' };
    }

    await prisma.animalBreed.delete({ where: { id } });
    revalidateSpecies(shelterSlug);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la race');
  }
}

export async function createVariant(
  shelterSlug: string,
  data: { breedId: string; label: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const breedId = z.string().uuid().parse(data.breedId);
    const label = variantLabelSchema.parse(data.label);

    const breed = await requireBreedInShelter(shelterId, breedId);
    if (!breed) {
      return { status: 404, error: 'Race introuvable' };
    }

    const maxOrder = await prisma.animalSpeciesVariant.aggregate({
      where: { breedId },
      _max: { sortOrder: true },
    });

    try {
      const row = await prisma.animalSpeciesVariant.create({
        data: {
          breedId,
          label,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      revalidateSpecies(shelterSlug);
      return { status: 201, data: row };
    } catch (error) {
      return {
        status: 409,
        error: uniqueConflictMessage('Cette variante existe déjà', error),
      };
    }
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la variante');
  }
}

export async function updateVariant(
  shelterSlug: string,
  data: { id: string; label: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);
    const label = variantLabelSchema.parse(data.label);

    const existing = await prisma.animalSpeciesVariant.findFirst({
      where: { id, breed: { species: { shelterId } } },
      select: { id: true },
    });
    if (!existing) {
      return { status: 404, error: 'Variante introuvable' };
    }

    try {
      const row = await prisma.animalSpeciesVariant.update({
        where: { id },
        data: { label },
      });
      revalidateSpecies(shelterSlug);
      return { status: 200, data: row };
    } catch (error) {
      return {
        status: 409,
        error: uniqueConflictMessage('Cette variante existe déjà', error),
      };
    }
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification de la variante');
  }
}

export async function deleteVariant(shelterSlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(data.id);

    const existing = await prisma.animalSpeciesVariant.findFirst({
      where: { id, breed: { species: { shelterId } } },
      select: { id: true },
    });
    if (!existing) {
      return { status: 404, error: 'Variante introuvable' };
    }

    await prisma.animalSpeciesVariant.delete({ where: { id } });
    revalidateSpecies(shelterSlug);
    return { status: 200, data: { id } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la variante');
  }
}

export async function reorderSpecies(
  shelterSlug: string,
  data: { items: { id: string; sortOrder: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const { items } = reorderItemsSchema.parse(data);
    const ids = items.map((item) => item.id);

    const owned = await prisma.animalSpecies.findMany({
      where: { shelterId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return { status: 404, error: 'Une ou plusieurs espèces sont introuvables' };
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.animalSpecies.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    revalidateSpecies(shelterSlug);
    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du réordonnancement des espèces');
  }
}

export async function reorderBreeds(
  shelterSlug: string,
  data: { speciesId: string; items: { id: string; sortOrder: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const speciesId = z.string().uuid().parse(data.speciesId);
    const { items } = reorderItemsSchema.parse({ items: data.items });
    const ids = items.map((item) => item.id);

    const species = await requireSpeciesInShelter(shelterId, speciesId);
    if (!species) {
      return { status: 404, error: 'Espèce introuvable' };
    }

    const owned = await prisma.animalBreed.findMany({
      where: { speciesId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return { status: 404, error: 'Une ou plusieurs races sont introuvables' };
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.animalBreed.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    revalidateSpecies(shelterSlug);
    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du réordonnancement des races');
  }
}

export async function reorderVariants(
  shelterSlug: string,
  data: { breedId: string; items: { id: string; sortOrder: number }[] },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, speciesActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const breedId = z.string().uuid().parse(data.breedId);
    const { items } = reorderItemsSchema.parse({ items: data.items });
    const ids = items.map((item) => item.id);

    const breed = await requireBreedInShelter(shelterId, breedId);
    if (!breed) {
      return { status: 404, error: 'Race introuvable' };
    }

    const owned = await prisma.animalSpeciesVariant.findMany({
      where: { breedId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return { status: 404, error: 'Une ou plusieurs variantes sont introuvables' };
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.animalSpeciesVariant.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    revalidateSpecies(shelterSlug);
    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du réordonnancement des variantes');
  }
}
