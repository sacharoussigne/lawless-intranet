'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { canEditCabinetFormSchema } from '@/lib/cabinet/access';
import { saveFormSchemaEntitySchema } from '@/app/_actions/cabinet/schemas';
import type { CabinetFormSchemas, FormEntitySchema, FormEntityType } from '@/lib/cabinet/formSchema';
import { parseCabinetFormSchemas } from '@/lib/cabinet/formSchema';
import {
  cabinetDisplaySettingsSchema,
  collectFieldIdsFromSchemas,
  parseCabinetDisplaySettings,
  pruneFieldLabelColors,
  type CabinetDisplaySettings,
} from '@/lib/cabinet/displaySettings';
import { getCabinetSessionContext } from '@/app/_actions/cabinet/internals';

function entityKey(entityType: FormEntityType): keyof CabinetFormSchemas {
  return entityType;
}

async function loadAndGuardSchemas(
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
    return { error: { status: 403, error: 'Droits insuffisants pour modifier le schéma' } };
  }

  const cabinet = await prisma.cabinet.findFirst({
    where: { id: cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
    select: { formSchemas: true, displaySettings: true, name: true },
  });
  if (!cabinet) {
    return { error: { status: 404, error: 'Cabinet introuvable' } };
  }

  return {
    ctx,
    cabinetName: cabinet.name,
    schemas: parseCabinetFormSchemas(cabinet.formSchemas),
    displaySettings: parseCabinetDisplaySettings(cabinet.displaySettings),
  };
}

export async function getCabinetFormSchemas(dispensarySlug: string, cabinetId: string) {
  try {
    const loaded = await loadAndGuardSchemas(dispensarySlug, cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { cabinetName, schemas, displaySettings } = loaded as {
      cabinetName: string;
      schemas: CabinetFormSchemas;
      displaySettings: CabinetDisplaySettings;
    };

    return {
      status: 200,
      data: { cabinetName, formSchemas: schemas, displaySettings },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des formulaires');
  }
}

async function saveCabinetConfiguration(
  cabinetId: string,
  dispensaryId: string,
  schemas: CabinetFormSchemas,
  displaySettings?: CabinetDisplaySettings,
) {
  const data: { formSchemas: object; displaySettings?: object } = {
    formSchemas: schemas as object,
  };

  if (displaySettings !== undefined) {
    const validFieldIds = collectFieldIdsFromSchemas(schemas);
    data.displaySettings = pruneFieldLabelColors(displaySettings, validFieldIds) as object;
  }

  await prisma.cabinet.update({
    where: { id: cabinetId, ...tenantWhere(dispensaryId) },
    data,
  });
}

export async function saveFormSchemaEntity(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    schema: FormEntitySchema;
    displaySettings?: CabinetDisplaySettings;
  },
) {
  try {
    const validated = saveFormSchemaEntitySchema.parse(data);
    const incomingDisplaySettings = data.displaySettings
      ? cabinetDisplaySettingsSchema.parse(data.displaySettings)
      : undefined;
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas, displaySettings: savedDisplaySettingsBeforeSave } = loaded as {
      ctx: NonNullable<typeof loaded.ctx>;
      schemas: CabinetFormSchemas;
      displaySettings: CabinetDisplaySettings;
    };
    const key = entityKey(validated.entityType);
    const current = schemas[key];
    const incoming = validated.schema as FormEntitySchema;

    const systemCategories = current.categories.filter((c) => c.isSystem);
    for (const systemCat of systemCategories) {
      const preserved = incoming.categories.find((c) => c.id === systemCat.id);
      if (!preserved) {
        return {
          status: 400,
          error: 'Les catégories système ne peuvent pas être supprimées',
        };
      }
      if (preserved.isSystem !== true || preserved.systemKey !== systemCat.systemKey) {
        return {
          status: 400,
          error: 'Les catégories système ne peuvent pas être modifiées',
        };
      }
    }

    schemas[key] = {
      categories: incoming.categories
        .map((c) => ({
          ...c,
          fields: [...c.fields].sort((a, b) => a.order - b.order),
        }))
        .sort((a, b) => a.order - b.order),
    };

    await saveCabinetConfiguration(
      validated.cabinetId,
      ctx.tenant.dispensaryId,
      schemas,
      incomingDisplaySettings,
    );

    const savedDisplaySettings =
      incomingDisplaySettings !== undefined
        ? pruneFieldLabelColors(incomingDisplaySettings, collectFieldIdsFromSchemas(schemas))
        : savedDisplaySettingsBeforeSave;

    return {
      status: 200,
      data: { formSchemas: schemas, displaySettings: savedDisplaySettings },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la sauvegarde du schéma');
  }
}
