'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { canEditCabinetFormSchema } from '@/lib/cabinet/access';
import {
  cabinetDisplaySettingsSchema,
  parseCabinetDisplaySettings,
  type CabinetDisplaySettings,
} from '@/lib/cabinet/displaySettings';
import { getCabinetSessionContext } from '@/app/_actions/cabinet/internals';
import { z } from 'zod';

const updateDisplaySettingsSchema = z.object({
  cabinetId: z.string().uuid(),
  displaySettings: cabinetDisplaySettingsSchema,
});

async function loadAndGuardDisplaySettings(
  dispensarySlug: string,
  cabinetId: string,
) {
  const ctx = await getCabinetSessionContext(dispensarySlug);
  if (!ctx.ok) return { error: ctx.response };

  const canEdit = await canEditCabinetFormSchema(
    ctx.tenant.dispensaryId,
    cabinetId,
    ctx.session.user.id,
    ctx.session.user.role,
    ctx.tenant.effectiveRole,
  );
  if (!canEdit) {
    return { error: { status: 403, error: 'Droits insuffisants pour modifier l\'affichage' } };
  }

  const cabinet = await prisma.cabinet.findFirst({
    where: { id: cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
    select: { displaySettings: true, name: true },
  });
  if (!cabinet) {
    return { error: { status: 404, error: 'Cabinet introuvable' } };
  }

  return {
    ctx,
    cabinetName: cabinet.name,
    displaySettings: parseCabinetDisplaySettings(cabinet.displaySettings),
  };
}

export async function getCabinetDisplaySettings(
  dispensarySlug: string,
  cabinetId: string,
) {
  try {
    const loaded = await loadAndGuardDisplaySettings(dispensarySlug, cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { cabinetName, displaySettings } = loaded as {
      cabinetName: string;
      displaySettings: CabinetDisplaySettings;
    };

    return {
      status: 200,
      data: { cabinetName, displaySettings },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des paramètres d\'affichage');
  }
}

export async function updateCabinetDisplaySettings(
  dispensarySlug: string,
  data: { cabinetId: string; displaySettings: CabinetDisplaySettings },
) {
  try {
    const validated = updateDisplaySettingsSchema.parse(data);
    const loaded = await loadAndGuardDisplaySettings(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx } = loaded as { ctx: NonNullable<typeof loaded.ctx> };

    await prisma.cabinet.update({
      where: { id: validated.cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
      data: { displaySettings: validated.displaySettings as object },
    });

    return {
      status: 200,
      data: validated.displaySettings,
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la sauvegarde des paramètres d\'affichage');
  }
}
