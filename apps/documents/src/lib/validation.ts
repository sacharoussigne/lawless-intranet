import { z } from 'zod';

export const accessTypeSchema = z.enum(['READ', 'WRITE']);

export const listQuerySchema = z.object({
  type: z.string().min(1),
  scopeId: z.string().min(1),
  ownerId: z.string().optional(),
  ownerScope: z.enum(['org', 'personal', 'all', 'accessible']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  nameSearch: z.string().max(255).optional(),
  receiverSearch: z.string().max(255).optional(),
});

export const createTemplateSchema = z.object({
  type: z.string().min(1),
  scopeId: z.string().min(1),
  ownerId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const createDocumentSchema = z.object({
  type: z.string().min(1),
  scopeId: z.string().min(1),
  name: z.string().min(1).max(255),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateDocumentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const grantAccessSchema = z.object({
  userId: z.string().min(1),
  accessType: accessTypeSchema,
});

export function parseOwnerIdFilter(
  ownerId: string | undefined,
  ownerScope: 'org' | 'personal' | 'all' | 'accessible' | undefined,
  userId: string,
): string | null | undefined {
  if (ownerScope === 'org') {
    return null;
  }

  if (ownerScope === 'personal') {
    return userId;
  }

  if (ownerId === 'null') {
    return null;
  }

  if (ownerId) {
    return ownerId;
  }

  return undefined;
}
