import { z } from 'zod';
import type { CabinetFormSchemas, FormEntitySchema } from './types';
import { SYSTEM_CATEGORY_IDS } from './types';

const selectOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const optionalString = z.string().trim().max(500).optional();

const formFieldSchema: z.ZodType<{
  id: string;
  type: 'text' | 'date' | 'textarea' | 'select';
  label: string;
  required: boolean;
  order: number;
  placeholder?: string;
  defaultValue?: string;
  editable?: boolean;
  options?: { id: string; label: string }[];
  conditionalBranches?: { optionId: string; fields: unknown[] }[];
}> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.enum(['text', 'date', 'textarea', 'select']),
    label: z.string().min(1).max(200),
    required: z.boolean(),
    order: z.number().int(),
    placeholder: optionalString,
    defaultValue: optionalString,
    editable: z.boolean().optional(),
    options: z.array(selectOptionSchema).optional(),
    conditionalBranches: z
      .array(
        z.object({
          optionId: z.string().min(1),
          fields: z.array(formFieldSchema),
        }),
      )
      .optional(),
  }),
);

const formCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  isSystem: z.boolean(),
  systemKey: z
    .enum(['patient_identity', 'care_episode_general', 'consultation_general'])
    .optional(),
  order: z.number().int(),
  fields: z.array(formFieldSchema),
});

const formEntitySchema = z.object({
  categories: z.array(formCategorySchema),
});

export const cabinetFormSchemasSchema = z.object({
  patient: formEntitySchema,
  careEpisode: formEntitySchema,
  consultation: formEntitySchema,
});

export function parseCabinetFormSchemas(raw: unknown): CabinetFormSchemas {
  const parsed = cabinetFormSchemasSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as CabinetFormSchemas;
  }
  return createDefaultFormSchemas();
}

export function createDefaultFormSchemas(): CabinetFormSchemas {
  const patient: FormEntitySchema = {
    categories: [
      {
        id: SYSTEM_CATEGORY_IDS.patientIdentity,
        name: 'Fiche patient',
        isSystem: true,
        systemKey: 'patient_identity',
        order: 0,
        fields: [],
      },
    ],
  };

  const careEpisode: FormEntitySchema = {
    categories: [
      {
        id: SYSTEM_CATEGORY_IDS.careEpisodeGeneral,
        name: 'Général',
        isSystem: true,
        systemKey: 'care_episode_general',
        order: 0,
        fields: [],
      },
    ],
  };

  const consultation: FormEntitySchema = {
    categories: [
      {
        id: SYSTEM_CATEGORY_IDS.consultationGeneral,
        name: 'Général',
        isSystem: true,
        systemKey: 'consultation_general',
        order: 0,
        fields: [],
      },
    ],
  };

  return { patient, careEpisode, consultation };
}

export function getEntitySchema(
  schemas: CabinetFormSchemas,
  entityType: keyof CabinetFormSchemas,
): FormEntitySchema {
  return schemas[entityType] ?? createDefaultFormSchemas()[entityType];
}
