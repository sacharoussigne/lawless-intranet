import { z } from 'zod';
import { MEDIA_NAME_MAX_LENGTH, normalizeMediaName } from '@/lib/names';

export const scopeFieldsSchema = z.object({
  scopeType: z.string().min(1).max(64),
  scopeId: z.string().min(1).max(128),
});

const mediaNameSchema = z
  .string()
  .transform(normalizeMediaName)
  .pipe(
    z
      .string()
      .min(1, 'Le nom est requis')
      .max(MEDIA_NAME_MAX_LENGTH, `Le nom est trop long (${MEDIA_NAME_MAX_LENGTH} caractères maximum)`),
  );

const optionalFolderIdSchema = z.string().uuid('Dossier invalide').nullable().optional();

export const folderContentsQuerySchema = scopeFieldsSchema.extend({
  folderId: z.string().uuid('Dossier invalide').optional(),
});

export const createFolderSchema = scopeFieldsSchema.extend({
  parentId: optionalFolderIdSchema,
  name: mediaNameSchema,
});

export const updateFolderSchema = scopeFieldsSchema.extend({
  name: mediaNameSchema.optional(),
  /** null moves the folder to the root; undefined keeps it in place. */
  parentId: optionalFolderIdSchema,
});

export const createUploadSchema = scopeFieldsSchema.extend({
  folderId: optionalFolderIdSchema,
  name: mediaNameSchema,
  mimeType: z.string().min(1).max(128),
  size: z.number().int(),
});

export const updateFileSchema = scopeFieldsSchema.extend({
  name: mediaNameSchema.optional(),
  /** null moves the file to the root; undefined keeps it in place. */
  folderId: optionalFolderIdSchema,
});

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides';
}

export function readScopeQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return Object.fromEntries(searchParams.entries());
}
