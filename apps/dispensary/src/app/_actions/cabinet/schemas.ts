import { z } from 'zod';

export const cabinetAccessLevelSchema = z.enum(['OWNER', 'WRITE', 'READ']);

export const createCabinetSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  ownerUserId: z.string().min(1, 'Le propriétaire est requis'),
});

export const updateCabinetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Le nom est requis').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const deleteCabinetSchema = z.object({
  id: z.string().uuid(),
});

export const upsertCabinetMemberSchema = z.object({
  cabinetId: z.string().uuid(),
  userId: z.string().min(1),
  accessLevel: cabinetAccessLevelSchema,
});

export const removeCabinetMemberSchema = z.object({
  cabinetId: z.string().uuid(),
  userId: z.string().min(1),
});

export const createPatientSchema = z.object({
  cabinetId: z.string().uuid(),
  firstName: z.string().trim().min(1, 'Le prénom est requis').max(120),
  lastName: z.string().trim().min(1, 'Le nom est requis').max(120),
  birthDate: z.string().datetime().optional().nullable(),
  emergencyContact: z.string().trim().max(500).optional().nullable(),
  customValues: z.record(z.string().nullable()).optional(),
});

export const updatePatientSchema = createPatientSchema.extend({
  id: z.string().uuid(),
});

export const deletePatientSchema = z.object({
  id: z.string().uuid(),
});

export const createCareEpisodeSchema = z.object({
  patientId: z.string().uuid(),
  motif: z.string().trim().min(1, 'Le motif est requis').max(500),
  startedAt: z.string().datetime(),
  customValues: z.record(z.string().nullable()).optional(),
});

export const updateCareEpisodeSchema = createCareEpisodeSchema.extend({
  id: z.string().uuid(),
});

export const deleteCareEpisodeSchema = z.object({
  id: z.string().uuid(),
});

export const createConsultationSchema = z.object({
  careEpisodeId: z.string().uuid(),
  date: z.string().datetime(),
  customValues: z.record(z.string().nullable()).optional(),
});

export const updateConsultationSchema = createConsultationSchema.extend({
  id: z.string().uuid(),
});

export const deleteConsultationSchema = z.object({
  id: z.string().uuid(),
});

const optionalString = z.string().trim().max(500).optional();

const formFieldInputSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.enum(['text', 'date', 'textarea', 'select']),
    label: z.string().min(1).max(200),
    required: z.boolean(),
    order: z.number().int(),
    placeholder: optionalString,
    defaultValue: optionalString,
    editable: z.boolean().optional(),
    options: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
      .optional(),
    conditionalBranches: z
      .array(
        z.object({
          optionId: z.string().min(1),
          fields: z.array(formFieldInputSchema),
        }),
      )
      .optional(),
  }),
);

export const addFormCategorySchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  name: z.string().trim().min(1).max(120),
});

export const updateFormCategorySchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
});

export const deleteFormCategorySchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  categoryId: z.string().min(1),
});

export const addFormFieldSchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  categoryId: z.string().min(1),
  field: formFieldInputSchema,
});

export const updateFormFieldSchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  categoryId: z.string().min(1),
  fieldId: z.string().min(1),
  field: formFieldInputSchema,
});

export const deleteFormFieldSchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  categoryId: z.string().min(1),
  fieldId: z.string().min(1),
});

export const reorderFormCategoriesSchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  items: z.array(z.object({ id: z.string().min(1), order: z.number().int() })),
});

export const reorderFormFieldsSchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  categoryId: z.string().min(1),
  items: z.array(z.object({ id: z.string().min(1), order: z.number().int() })),
});

const formEntitySchemaInput = z.object({
  categories: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(120),
      isSystem: z.boolean(),
      systemKey: z
        .enum(['patient_identity', 'care_episode_general', 'consultation_general'])
        .optional(),
      order: z.number().int(),
      fields: z.array(formFieldInputSchema),
    }),
  ),
});

export const saveFormSchemaEntitySchema = z.object({
  cabinetId: z.string().uuid(),
  entityType: z.enum(['patient', 'careEpisode', 'consultation']),
  schema: formEntitySchemaInput,
});

export const listPatientsSchema = z.object({
  cabinetId: z.string().uuid(),
  search: z.string().trim().optional(),
});
