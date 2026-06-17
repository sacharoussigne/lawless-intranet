'use server';

import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { canEditCabinetFormSchema } from '@/lib/cabinet/access';
import {
  addFormCategorySchema,
  updateFormCategorySchema,
  deleteFormCategorySchema,
  addFormFieldSchema,
  updateFormFieldSchema,
  deleteFormFieldSchema,
  reorderFormCategoriesSchema,
  reorderFormFieldsSchema,
} from '@/app/_actions/cabinet/schemas';
import { getCabinetSessionContext } from '@/app/_actions/cabinet/internals';
import {
  type CabinetFormSchemas,
  type FormEntityType,
  type FormField,
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

export async function addFormCategory(
  dispensarySlug: string,
  data: { cabinetId: string; entityType: FormEntityType; name: string },
) {
  try {
    const validated = addFormCategorySchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const entity = schemas[key];
    const maxOrder = entity.categories.reduce((m, c) => Math.max(m, c.order), -1);

    entity.categories.push({
      id: randomUUID(),
      name: validated.name,
      isSystem: false,
      order: maxOrder + 1,
      fields: [],
    });

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l\'ajout de la catégorie');
  }
}

export async function updateFormCategory(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    categoryId: string;
    name?: string;
  },
) {
  try {
    const validated = updateFormCategorySchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const category = schemas[key].categories.find((c) => c.id === validated.categoryId);
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }
    if (category.isSystem && validated.name) {
      return { status: 400, error: 'Impossible de renommer une catégorie système' };
    }
    if (validated.name) {
      category.name = validated.name;
    }

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la catégorie');
  }
}

export async function deleteFormCategory(
  dispensarySlug: string,
  data: { cabinetId: string; entityType: FormEntityType; categoryId: string },
) {
  try {
    const validated = deleteFormCategorySchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const category = schemas[key].categories.find((c) => c.id === validated.categoryId);
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }
    if (category.isSystem) {
      return { status: 400, error: 'Impossible de supprimer une catégorie système' };
    }

    schemas[key].categories = schemas[key].categories.filter(
      (c) => c.id !== validated.categoryId,
    );

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la catégorie');
  }
}

export async function addFormField(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    categoryId: string;
    field: FormField;
  },
) {
  try {
    const validated = addFormFieldSchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const category = schemas[key].categories.find((c) => c.id === validated.categoryId);
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }

    const field = validated.field as FormField;
    if (!field.id) {
      field.id = randomUUID();
    }
    category.fields.push(field);
    category.fields.sort((a, b) => a.order - b.order);

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l\'ajout du champ');
  }
}

export async function updateFormField(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    categoryId: string;
    fieldId: string;
    field: FormField;
  },
) {
  try {
    const validated = updateFormFieldSchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const category = schemas[key].categories.find((c) => c.id === validated.categoryId);
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }

    const idx = category.fields.findIndex((f) => f.id === validated.fieldId);
    if (idx === -1) {
      return { status: 404, error: 'Champ introuvable' };
    }

    category.fields[idx] = { ...(validated.field as FormField), id: validated.fieldId };
    category.fields.sort((a, b) => a.order - b.order);

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du champ');
  }
}

export async function deleteFormField(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    categoryId: string;
    fieldId: string;
  },
) {
  try {
    const validated = deleteFormFieldSchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const category = schemas[key].categories.find((c) => c.id === validated.categoryId);
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }

    category.fields = category.fields.filter((f) => f.id !== validated.fieldId);

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du champ');
  }
}

export async function reorderFormCategories(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    items: { id: string; order: number }[];
  },
) {
  try {
    const validated = reorderFormCategoriesSchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const orderMap = new Map(validated.items.map((i) => [i.id, i.order]));

    for (const category of schemas[key].categories) {
      const order = orderMap.get(category.id);
      if (order !== undefined) {
        category.order = order;
      }
    }
    schemas[key].categories.sort((a, b) => a.order - b.order);

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du réordonnancement');
  }
}

export async function reorderFormFields(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    entityType: FormEntityType;
    categoryId: string;
    items: { id: string; order: number }[];
  },
) {
  try {
    const validated = reorderFormFieldsSchema.parse(data);
    const loaded = await loadAndGuardSchemas(dispensarySlug, validated.cabinetId);
    if ('error' in loaded && loaded.error) return loaded.error;

    const { ctx, schemas } = loaded as { ctx: NonNullable<typeof loaded.ctx>; schemas: CabinetFormSchemas };
    const key = entityKey(validated.entityType);
    const category = schemas[key].categories.find((c) => c.id === validated.categoryId);
    if (!category) {
      return { status: 404, error: 'Catégorie introuvable' };
    }

    const orderMap = new Map(validated.items.map((i) => [i.id, i.order]));
    for (const field of category.fields) {
      const order = orderMap.get(field.id);
      if (order !== undefined) {
        field.order = order;
      }
    }
    category.fields.sort((a, b) => a.order - b.order);

    await saveSchemas(validated.cabinetId, ctx.tenant.dispensaryId, schemas);
    return { status: 200, data: schemas };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du réordonnancement des champs');
  }
}
