import { z } from 'zod';

export const scopeFieldsSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
});

export const transactionTypeSchema = z.enum([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);

export const createTransactionSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
  weekId: z.string().uuid(),
  date: z.string().or(z.date()),
  type: transactionTypeSchema,
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().positive(),
  order: z.number().int().optional(),
  orderId: z.string().uuid().optional().nullable(),
});

export const updateTransactionSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
  id: z.string().uuid(),
  date: z.string().or(z.date()).optional(),
  type: transactionTypeSchema.optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  amount: z.number().positive().optional(),
  order: z.number().int().optional(),
});

export const deleteTransactionSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
  id: z.string().uuid(),
});

export const createPlannedTransactionSchema = z
  .object({
    scopeType: z.string().min(1),
    scopeId: z.string().uuid(),
    type: transactionTypeSchema,
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    amount: z.number().positive(),
    scheduleKind: z.enum(['ONCE', 'WEEKLY']),
    onceDate: z.string().or(z.date()).optional().nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleKind === 'ONCE' && !data.onceDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'La date est requise pour une transaction unique',
        path: ['onceDate'],
      });
    }
    if (data.scheduleKind === 'WEEKLY' && (!data.weekdays || data.weekdays.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Au moins un jour de la semaine est requis',
        path: ['weekdays'],
      });
    }
  });

export const updatePlannedTransactionSchema = z
  .object({
    scopeType: z.string().min(1),
    scopeId: z.string().uuid(),
    id: z.string().uuid(),
    type: transactionTypeSchema.optional(),
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional().nullable(),
    amount: z.number().positive().optional(),
    scheduleKind: z.enum(['ONCE', 'WEEKLY']).optional(),
    onceDate: z.string().or(z.date()).optional().nullable(),
    weekdays: z.array(z.number().int().min(1).max(7)).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const kind = data.scheduleKind;
    if (kind === 'ONCE' && data.onceDate === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'La date est requise pour une transaction unique',
        path: ['onceDate'],
      });
    }
    if (kind === 'WEEKLY' && data.weekdays !== undefined && data.weekdays.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Au moins un jour de la semaine est requis',
        path: ['weekdays'],
      });
    }
  });

export const createFromOrderSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
  orderId: z.string().uuid(),
  orderName: z.string().min(1),
  orderType: z.enum(['INCOMING', 'OUTGOING']),
  amount: z.number().positive(),
  date: z.string().or(z.date()),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  type: transactionTypeSchema,
});

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(', ') || 'Validation error';
}
