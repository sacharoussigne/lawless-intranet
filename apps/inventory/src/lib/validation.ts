import { z } from 'zod';

export const scopeFieldsSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
});

export const idSchema = z.string().uuid('ID invalide');

export const reorderItemsSchema = z.object({
  scopeType: z.string().min(1),
  scopeId: z.string().uuid(),
  items: z.array(
    z.object({
      id: z.string().uuid('ID invalide'),
      order: z.number().int(),
    }),
  ),
});

export const createCategorySchema = scopeFieldsSchema.extend({
  name: z.string().min(1, 'Le nom est requis').max(255),
  color: z.string().min(1).max(7).optional(),
});

export const updateCategorySchema = scopeFieldsSchema.extend({
  id: idSchema,
  name: z.string().min(1, 'Le nom est requis').max(255),
  color: z.string().min(1).max(7).optional(),
});

export const deleteByIdSchema = scopeFieldsSchema.extend({
  id: idSchema,
});

export const createItemSchema = scopeFieldsSchema.extend({
  name: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().max(1000).optional().nullable(),
  minimalQuantity: z.number().int().min(0),
  isCraftable: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  canBeSold: z.boolean().optional(),
  price: z.number().positive().optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  categoryId: z.string().uuid('ID de catégorie invalide'),
  companyGroupId: z.string().uuid().optional().nullable(),
});

export const updateItemSchema = createItemSchema.extend({
  id: idSchema,
});

export const createChestSchema = scopeFieldsSchema.extend({
  name: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().max(1000).optional().nullable(),
  isEnabled: z.boolean().optional(),
});

export const updateChestSchema = scopeFieldsSchema.extend({
  id: idSchema,
  name: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().max(1000).optional().nullable(),
  isEnabled: z.boolean(),
});

export const deleteChestSchema = scopeFieldsSchema.extend({
  id: idSchema,
  targetChestId: z.string().uuid('ID de coffre de destination invalide'),
});

export const upsertRoleChestAccessSchema = scopeFieldsSchema.extend({
  role: z.string().min(1),
  allChests: z.boolean(),
  chestIds: z.array(z.string().uuid()).optional(),
});

export const createCompanySchema = scopeFieldsSchema.extend({
  name: z.string().min(1, 'Le nom est requis').max(255),
  bankAccountNumber: z.string().trim().max(64).optional().nullable(),
  companyGroupIds: z.array(z.string().uuid()).optional(),
});

export const updateCompanySchema = createCompanySchema.extend({
  id: idSchema,
});

export const createCompanyGroupSchema = scopeFieldsSchema.extend({
  name: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().max(1000).optional().nullable(),
  companyIds: z.array(z.string().uuid()).optional(),
});

export const updateCompanyGroupSchema = createCompanyGroupSchema.extend({
  id: idSchema,
});

export const createCustomerSchema = scopeFieldsSchema.extend({
  name: z.string().min(1, 'Le nom est requis').max(255),
});

export const deleteCustomerByNameSchema = scopeFieldsSchema.extend({
  name: z.string().min(1).max(255),
});

export const craftIngredientSchema = z.object({
  usedItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export const createCraftRecipeSchema = scopeFieldsSchema.extend({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  craftedItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  isEnabled: z.boolean().optional(),
  ingredients: z.array(craftIngredientSchema).min(1),
});

export const updateCraftRecipeSchema = scopeFieldsSchema.extend({
  id: idSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  quantity: z.number().int().min(1),
  isEnabled: z.boolean().optional(),
  ingredients: z.array(craftIngredientSchema).min(1),
});

export const orderStatusSchema = z.enum([
  'DRAFT',
  'LETTER_SENT',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

export const orderTypeSchema = z.enum(['INCOMING', 'OUTGOING']);

export const orderItemInputSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

export const createOrderSchema = scopeFieldsSchema
  .extend({
    name: z.string().max(255).optional(),
    status: orderStatusSchema.optional(),
    type: orderTypeSchema.optional(),
    details: z.string().max(1000).optional().nullable(),
    price: z.number().positive().optional().nullable(),
    companyId: z.string().uuid().optional().nullable(),
    individualCustomerId: z.string().uuid().optional().nullable(),
    companyGroupId: z.string().uuid().optional().nullable(),
    items: z.array(orderItemInputSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const hasCompany = Boolean(data.companyId);
    const hasCustomer = Boolean(data.individualCustomerId);
    if (hasCompany === hasCustomer) {
      ctx.addIssue({
        code: 'custom',
        message: 'Indiquez une entreprise ou un particulier',
        path: ['companyId'],
      });
    }
  });

export const updateOrderSchema = scopeFieldsSchema.extend({
  id: idSchema,
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['DRAFT', 'LETTER_SENT', 'PROCESSING', 'READY', 'CANCELLED']).optional(),
  type: orderTypeSchema.optional(),
  details: z.string().max(1000).optional().nullable(),
  price: z.number().positive().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1).optional(),
});

export const completeOrderSchema = scopeFieldsSchema.extend({
  id: idSchema,
  name: z.string().min(1).max(255).optional(),
  type: orderTypeSchema.optional(),
  details: z.string().max(1000).optional().nullable(),
  price: z.number().positive().optional().nullable(),
  items: z.array(orderItemInputSchema).min(1).optional(),
  skipStock: z.boolean(),
  stockLines: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        quantity: z.number().int().min(1),
        chestId: z.string().uuid(),
      }),
    )
    .optional(),
  effectiveRole: z.string().optional().nullable(),
});

export const saleItemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  source: z.enum(['POCKET', 'CHEST']),
  chestId: z.string().uuid().nullable().optional(),
});

export const createSaleSchema = scopeFieldsSchema.extend({
  userId: z.string().min(1),
  defaultChestId: z.string().uuid().nullable().optional(),
  customerName: z.string().max(255).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  individualCustomerId: z.string().uuid().optional().nullable(),
  priceAdjustment: z.number().finite().optional(),
  items: z.array(saleItemSchema).min(1),
  effectiveRole: z.string().optional().nullable(),
});

export const saleActionSchema = scopeFieldsSchema.extend({
  id: idSchema,
  userId: z.string().min(1),
  canViewAll: z.boolean().optional(),
  canDepositOthers: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

export const updateStockSchema = scopeFieldsSchema.extend({
  stocks: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().int(),
    }),
  ),
  chestId: z.string().uuid().optional().nullable(),
  skipHistory: z.boolean().optional(),
  userId: z.string().optional().nullable(),
  effectiveRole: z.string().optional().nullable(),
});

export const craftStockSchema = scopeFieldsSchema.extend({
  craftedItemId: z.string().uuid(),
  recipeId: z.string().uuid(),
  times: z.number().int().min(1),
  sourceChestId: z.string().uuid().nullable().optional(),
  ingredientChests: z.array(
    z.object({
      ingredientId: z.string().uuid(),
      chestId: z.string().uuid(),
    }),
  ),
  destinationChestId: z.string().uuid().nullable().optional(),
  userId: z.string().optional().nullable(),
  effectiveRole: z.string().optional().nullable(),
});

export const transferStockSchema = scopeFieldsSchema.extend({
  sourceChestId: z.string().uuid(),
  destinationChestId: z.string().uuid(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().int(),
    }),
  ),
  userId: z.string().optional().nullable(),
  effectiveRole: z.string().optional().nullable(),
});

export const takeStockSchema = scopeFieldsSchema.extend({
  mode: z.enum(['take', 'deposit']),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().int(),
      chestId: z.string().uuid(),
    }),
  ),
  userId: z.string().optional().nullable(),
  effectiveRole: z.string().optional().nullable(),
});

export const overwriteStockSchema = scopeFieldsSchema.extend({
  date: z.string().or(z.date()),
  stocks: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().int(),
    }),
  ),
  chestId: z.string().uuid().optional().nullable(),
});

export const upsertStockCheckSchema = scopeFieldsSchema.extend({
  chestId: z.string().uuid(),
  isEnabled: z.boolean(),
  categoryIds: z.array(z.string().uuid()),
});

export const stockVisibilitySchema = scopeFieldsSchema.extend({
  chestId: z.string().uuid(),
  hidden: z.boolean(),
  categoryId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
});

export const orderMailAssignmentSchema = scopeFieldsSchema.extend({
  orderType: orderTypeSchema,
  orderStatus: orderStatusSchema,
  templateId: z.string().uuid(),
});

export const updateOrderMailAssignmentSchema = scopeFieldsSchema.extend({
  id: idSchema,
  templateId: z.string().uuid(),
});

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => i.message).join(', ') || 'Validation error';
}
