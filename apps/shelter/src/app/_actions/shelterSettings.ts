'use server';

import { revalidatePath } from 'next/cache';
import { updateTag } from 'next/cache';
import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import {
  appSettingsCacheTag,
  getAppSettings,
  type AppSettingsDTO,
} from '@/lib/appSettings';
import { requireShelterAdminContext } from '@/lib/shelter/serverActionContext';

export type ShelterSettingsAdminDTO = AppSettingsDTO & {
  slug: string;
};

const slugSchema = z
  .string()
  .trim()
  .min(1, 'Le slug est requis')
  .max(80, 'Le slug est trop long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (lettres minuscules, chiffres et tirets)');

const updateSchema = z.object({
  shelterName: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(120, 'Le nom est trop long'),
  slug: slugSchema,
  featureBankEnabled: z.boolean(),
});

export async function getAppSettingsForAdmin(
  shelterSlug: string,
): Promise<
  | { status: 200; data: ShelterSettingsAdminDTO }
  | { status: number; error: string }
> {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const settings = await getAppSettings(auth.ctx.shelterId);
    const data: ShelterSettingsAdminDTO = {
      ...settings,
      slug: auth.ctx.shelter.slug,
    };
    return { status: 200, data };
  } catch (error) {
    const parsed = actionErrorParser(
      error,
      'Erreur lors du chargement des paramètres',
    );
    return {
      status: 500,
      error:
        typeof parsed.error === 'string'
          ? parsed.error
          : 'Erreur lors du chargement des paramètres',
    };
  }
}

export async function updateAppSettings(
  shelterSlug: string,
  input: z.infer<typeof updateSchema>,
): Promise<
  | { status: 200; data: ShelterSettingsAdminDTO }
  | { status: number; error: string }
> {
  try {
    const auth = await requireShelterAdminContext(shelterSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }
    const { shelterId, shelter } = auth.ctx;

    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 400,
        error: parsed.error.issues[0]?.message ?? 'Données invalides',
      };
    }

    const newSlug = parsed.data.slug;
    if (newSlug !== shelter.slug) {
      const taken = await prisma.shelter.findFirst({
        where: { slug: newSlug, id: { not: shelterId } },
        select: { id: true },
      });
      if (taken) {
        return { status: 409, error: 'Ce slug est déjà utilisé par un autre refuge' };
      }
    }

    const [, row] = await prisma.$transaction([
      prisma.shelter.update({
        where: { id: shelterId },
        data: {
          name: parsed.data.shelterName,
          slug: newSlug,
        },
      }),
      prisma.appSettings.upsert({
        where: { shelterId },
        create: {
          shelterId,
          shelterName: parsed.data.shelterName,
          featureBankEnabled: parsed.data.featureBankEnabled,
        },
        update: {
          shelterName: parsed.data.shelterName,
          featureBankEnabled: parsed.data.featureBankEnabled,
        },
      }),
    ]);

    updateTag(appSettingsCacheTag(shelterId));
    revalidatePath(`/s/${shelter.slug}`, 'layout');
    if (newSlug !== shelter.slug) {
      revalidatePath(`/s/${newSlug}`, 'layout');
    }
    revalidatePath('/platform/shelters');

    const data: ShelterSettingsAdminDTO = {
      shelterName: row.shelterName,
      slug: newSlug,
      featureBankEnabled: row.featureBankEnabled,
    };

    return { status: 200, data };
  } catch (error) {
    const parsed = actionErrorParser(
      error,
      'Erreur lors de la mise à jour des paramètres',
    );
    return {
      status: 500,
      error:
        typeof parsed.error === 'string'
          ? parsed.error
          : 'Erreur lors de la mise à jour des paramètres',
    };
  }
}
