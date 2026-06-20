'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { canEditCabinetFormSchema } from '@/lib/cabinet/access';
import { saveFormSchemaEntitySchema } from '@/app/_actions/cabinet/schemas';
import type { FormEntitySchema } from '@/lib/cabinet/formSchema';
import { getCabinetSessionContext } from '@/app/_actions/cabinet/internals';
import {
  type CabinetFormSchemas,
  type FormEntityType,
  parseCabinetFormSchemas,
} from '@/lib/cabinet/formSchema';

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
    select: { formSchemas: true },
  });
  if (!cabinet) {
    return { error: { status: 404, error: 'Cabinet introuvable' } };
  }

  return {
    ctx,
    schemas: parseCabinetFormSchemas(cabinet.formSchemas),
  };
}

async function saveSchemas(cabinetId: string, dispensaryId: string, schemas: CabinetFormSchemas) {
  await prisma.cabinet.update({
    where: { id: cabinetId, ...tenantWhere(dispensaryId) },
    data: { formSchemas: schemas as object },
  });
}

export async function saveFormSchemaEntity(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    schema: FormEntitySchema;
  },
) {
  try {
    const validated = saveFormSchemaEntitySchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as {
      ctx: NonNullable<typeof loaded.ctx>;
      schemas: CabinetFormSchemas;
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

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la sauvegarde du schéma');
  }
}
