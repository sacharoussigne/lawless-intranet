import { z } from 'zod/v3';

export const letterBoxAccessLevelSchema = z.enum(['OWNER', 'WRITE', 'READ']);

export const createLetterBoxSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(120, 'Le nom est trop long'),
  description: z.string().trim().max(2000).optional().nullable(),
  ownerUserId: z.string().min(1, 'Le propriétaire est requis'),
});

export const updateLetterBoxSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Le nom est requis').max(120, 'Le nom est trop long'),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const letterBoxIdSchema = z.object({ id: z.string().uuid() });

export const upsertLetterBoxMemberSchema = z.object({
  boxId: z.string().uuid(),
  userId: z.string().min(1),
  accessLevel: letterBoxAccessLevelSchema,
});

export const removeLetterBoxMemberSchema = z.object({
  boxId: z.string().uuid(),
  userId: z.string().min(1),
});

export const correspondentSchema = z.object({
  boxId: z.string().uuid(),
  name: z.string().trim().min(1, 'Le nom est requis').max(120, 'Le nom est trop long'),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const updateCorrespondentSchema = correspondentSchema.omit({ boxId: true }).extend({
  id: z.string().uuid(),
});

export const letterImageInputSchema = z.object({ mediaFileId: z.string().uuid() });

export const letterInputSchema = z.object({
  correspondentId: z.string().uuid(),
  direction: z.enum(['RECEIVED', 'SENT']),
  title: z.string().trim().min(1, 'Le titre est requis').max(200, 'Le titre est trop long'),
  transcript: z.string().max(50_000, 'Le transcript est trop long').optional().nullable(),
  letterDate: z.coerce.date({ invalid_type_error: 'Date invalide' }),
  replyToId: z.string().uuid().optional().nullable(),
  /** Images in display order (files already uploaded to the letters scope). */
  images: z.array(letterImageInputSchema).max(20, '20 images au plus par lettre'),
});

export const createLetterSchema = letterInputSchema.extend({ boxId: z.string().uuid() });

export const updateLetterSchema = letterInputSchema.extend({ id: z.string().uuid() });

export const letterIdSchema = z.object({ id: z.string().uuid() });

export const listLettersSchema = z.object({
  boxId: z.string().uuid(),
  correspondentId: z.string().uuid(),
  search: z.string().trim().max(200).optional(),
  includeArchived: z.boolean().optional(),
});

export const searchLettersSchema = z.object({
  boxId: z.string().uuid(),
  query: z.string().trim().min(1).max(200),
  includeArchived: z.boolean().optional(),
});

export const requestLetterImageUploadSchema = z.object({
  boxId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export const completeLetterImageUploadSchema = z.object({
  boxId: z.string().uuid(),
  fileId: z.string().uuid(),
});
