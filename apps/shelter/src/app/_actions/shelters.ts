'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { actionErrorParser } from '@/lib/action';
import { requirePlatformAdminContext } from '@/lib/shelter/serverActionContext';
import { slugifyShelterName } from '@/lib/shelter/slug';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import { purgeBankScope } from '@lawless-intranet/bank-client/server';
import { BankClientError } from '@lawless-intranet/bank-client';
import { bankScope } from '@/lib/bank/client';
import { ensureShelterRolePermissions } from '@/lib/shelter/permissionsSeed';

const createShelterSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
});

const deleteShelterSchema = z.object({
  id: z.string().uuid(),
});

export async function listSheltersForPlatform() {
  const auth = await requirePlatformAdminContext();
  if (!auth.ok) {
    return { status: auth.status, error: auth.error };
  }
  const rows = await prisma.shelter.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { members: true } },
      settings: { select: { shelterName: true } },
    },
  });
  return { status: 200, data: rows };
}

export async function createShelter(data: { name: string; slug?: string }) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = createShelterSchema.parse(data);
    const slug = validated.slug?.trim() || slugifyShelterName(validated.name);

    const existing = await prisma.shelter.findUnique({ where: { slug } });
    if (existing) {
      return { status: 409, error: 'Ce slug est déjà utilisé' };
    }

    const shelter = await prisma.shelter.create({
      data: {
        name: validated.name.trim(),
        slug,
        createdById: auth.userId,
        settings: {
          create: {
            ...APP_SETTINGS_DEFAULTS,
            shelterName: validated.name.trim(),
          },
        },
        members: {
          create: {
            userId: auth.userId,
            role: 'admin',
          },
        },
      },
    });

    await ensureShelterRolePermissions(shelter.id);

    revalidatePath('/platform/shelters');
    return { status: 201, data: shelter };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création du refuge');
  }
}

export async function deleteShelter(data: { id: string }) {
  try {
    const auth = await requirePlatformAdminContext();
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const validated = deleteShelterSchema.parse(data);
    const shelter = await prisma.shelter.findUnique({
      where: { id: validated.id },
      select: { id: true, name: true, slug: true },
    });

    if (!shelter) {
      return { status: 404, error: 'Refuge introuvable' };
    }

    try {
      await purgeBankScope(bankScope(shelter.id), { internal: true });
    } catch (error) {
      if (error instanceof BankClientError) {
        return { status: error.status, error: error.message };
      }
      console.error('Failed to purge bank scope', error);
    }

    await prisma.shelter.delete({ where: { id: shelter.id } });

    revalidatePath('/platform/shelters');
    return { status: 200, data: { id: shelter.id, name: shelter.name } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du refuge');
  }
}
