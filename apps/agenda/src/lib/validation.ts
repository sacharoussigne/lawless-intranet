import { z } from 'zod';

export const agendaAccessLevelSchema = z.enum(['OWNER', 'WRITE', 'READ']);

export const mutationMetaSchema = z
  .object({
    originClientId: z.string().optional(),
  })
  .optional();

export const scopeFieldsSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
});

export const scopeQuerySchema = scopeFieldsSchema;

export const scopeAdminQuerySchema = z.object({
  scopeAdmin: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const listAgendasQuerySchema = scopeFieldsSchema.extend({
  mode: z.enum(['accessible', 'all', 'bootstrap']).default('accessible'),
  scopeAdmin: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const createAgendaSchema = scopeFieldsSchema.extend({
  name: z.string().trim().min(1, 'Le nom est requis').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  ownerUserId: z.string().min(1, 'Le propriétaire est requis'),
  meta: mutationMetaSchema,
});

export const updateAgendaSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  scopeAdmin: z.boolean().optional(),
  meta: mutationMetaSchema,
});

export const deleteAgendaSchema = z.object({
  scopeAdmin: z.boolean().optional(),
  meta: mutationMetaSchema,
});

export const upsertAgendaMemberSchema = z.object({
  userId: z.string().min(1),
  accessLevel: agendaAccessLevelSchema,
  scopeAdmin: z.boolean().optional(),
  meta: mutationMetaSchema,
});

export const removeAgendaMemberSchema = z.object({
  scopeAdmin: z.boolean().optional(),
  meta: mutationMetaSchema,
});

export const createAgendaEventSchema = z.object({
  agendaId: z.string().uuid(),
  title: z.string().trim().min(1, 'Le titre est requis').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  startDate: z.string().min(1),
  startTime: z.string().optional(),
  endDate: z.string().min(1),
  endTime: z.string().optional(),
  allDay: z.boolean().default(false),
  participantUserIds: z.array(z.string().min(1)).default([]),
  meta: mutationMetaSchema,
});

export const updateAgendaEventSchema = z.object({
  agendaId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Le titre est requis').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  startDate: z.string().min(1),
  startTime: z.string().optional(),
  endDate: z.string().min(1),
  endTime: z.string().optional(),
  allDay: z.boolean().default(false),
  participantUserIds: z.array(z.string().min(1)).default([]),
  meta: mutationMetaSchema,
});

export const listAgendaEventsQuerySchema = scopeFieldsSchema.extend({
  agendaId: z.string().uuid().optional(),
  rangeStart: z.string().datetime(),
  rangeEnd: z.string().datetime(),
});

export const createTodoListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  meta: mutationMetaSchema,
});

export const updateTodoListSchema = z.object({
  name: z.string().trim().min(1).max(120),
  meta: mutationMetaSchema,
});

export const createTodoCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  meta: mutationMetaSchema,
});

export const updateTodoCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  meta: mutationMetaSchema,
});

export const createTodoTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  meta: mutationMetaSchema,
});

export const updateTodoTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  completed: z.boolean().optional(),
  categoryId: z.string().uuid().optional(),
  meta: mutationMetaSchema,
});

export const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int(),
    }),
  ),
  meta: mutationMetaSchema,
});

export const moveTodoTaskSchema = z.object({
  taskId: z.string().uuid(),
  sourceCategoryId: z.string().uuid(),
  targetCategoryId: z.string().uuid(),
  sourceOrders: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int(),
    }),
  ),
  targetOrders: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int(),
    }),
  ),
  meta: mutationMetaSchema,
});

export const createEventTodoTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  meta: mutationMetaSchema,
});

export const updateEventTodoTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  completed: z.boolean().optional(),
  meta: mutationMetaSchema,
});

export const deleteWithMetaSchema = z.object({
  meta: mutationMetaSchema,
  scopeAdmin: z.boolean().optional(),
});

export const streamQuerySchema = scopeFieldsSchema;

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides';
}
