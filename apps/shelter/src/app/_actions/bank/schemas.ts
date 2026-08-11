import { z } from 'zod/v3';

export const transactionTypeSchema = z.enum([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);

export const createTransactionSchema = z.object({
  weekId: z.string().uuid('ID de semaine invalide'),
  date: z.string().or(z.date()),
  type: transactionTypeSchema,
  name: z.string().min(1, 'Le nom est requis'),
  description: z.string().optional().nullable(),
  amount: z.number().positive('Le montant doit être positif'),
  order: z.number().int().optional(),
});

export const updateTransactionSchema = z.object({
  id: z.string().uuid('ID invalide'),
  date: z.string().or(z.date()).optional(),
  type: transactionTypeSchema.optional(),
  name: z.string().min(1, 'Le nom est requis').optional(),
  description: z.string().optional().nullable(),
  amount: z.number().positive('Le montant doit être positif').optional(),
  order: z.number().int().optional(),
});

export const deleteTransactionSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export const createPlannedTransactionSchema = z
  .object({
    type: transactionTypeSchema,
    name: z.string().min(1, 'Le nom est requis').max(255),
    description: z.string().max(1000).optional().nullable(),
    amount: z.number().positive('Le montant doit être positif'),
    scheduleKind: z.enum(['ONCE', 'WEEKLY']),
    onceDate: z.string().or(z.date()).optional().nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleKind === 'ONCE' && !data.onceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La date est requise pour une transaction unique',
        path: ['onceDate'],
      });
    }
    if (data.scheduleKind === 'WEEKLY' && (!data.weekdays || data.weekdays.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Au moins un jour de la semaine est requis',
        path: ['weekdays'],
      });
    }
  });

export const updatePlannedTransactionSchema = z
  .object({
    id: z.string().uuid('ID invalide'),
    type: transactionTypeSchema.optional(),
    name: z.string().min(1, 'Le nom est requis').max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
    amount: z.number().positive('Le montant doit être positif').optional(),
    scheduleKind: z.enum(['ONCE', 'WEEKLY']).optional(),
    onceDate: z.string().or(z.date()).optional().nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const kind = data.scheduleKind;
    if (kind === 'ONCE' && data.onceDate === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La date est requise pour une transaction unique',
        path: ['onceDate'],
      });
    }
    if (kind === 'WEEKLY' && data.weekdays !== undefined && data.weekdays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Au moins un jour de la semaine est requis',
        path: ['weekdays'],
      });
    }
  });

export const deletePlannedTransactionSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export const plannedOccurrenceIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

export const confirmPlannedOccurrenceSchema = z.object({
  id: z.string().uuid('ID invalide'),
  date: z.string().or(z.date()).optional(),
});
