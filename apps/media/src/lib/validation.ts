import { z } from 'zod';
import { MEDIA_NAME_MAX_LENGTH, normalizeLinkUrl, normalizeMediaName } from '@/lib/names';

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

const linkUrlSchema = z
  .string()
  .transform((raw, ctx) => {
    const url = normalizeLinkUrl(raw);
    if (!url) {
      ctx.addIssue({ code: 'custom', message: 'Adresse invalide (http:// ou https:// uniquement)' });
      return z.NEVER;
    }
    return url;
  });

export const createLinkSchema = scopeFieldsSchema.extend({
  folderId: optionalFolderIdSchema,
  /** Empty or missing: the host of the URL. */
  name: z
    .string()
    .transform(normalizeMediaName)
    .pipe(z.string().max(MEDIA_NAME_MAX_LENGTH, `Le nom est trop long (${MEDIA_NAME_MAX_LENGTH} caractères maximum)`))
    .optional(),
  url: linkUrlSchema,
});

export const updateLinkSchema = scopeFieldsSchema.extend({
  name: mediaNameSchema.optional(),
  url: linkUrlSchema.optional(),
  /** null moves the link to the root; undefined keeps it in place. */
  folderId: optionalFolderIdSchema,
});

const idListSchema = z.array(z.string().uuid('Élément invalide')).max(1000, 'Trop d’éléments à la fois');

const itemsSchema = scopeFieldsSchema.extend({
  folderIds: idListSchema.default([]),
  fileIds: idListSchema.default([]),
  linkIds: idListSchema.default([]),
});

type ItemIds = { folderIds: string[]; fileIds: string[]; linkIds: string[] };
const hasItems = (input: ItemIds) => input.folderIds.length + input.fileIds.length + input.linkIds.length > 0;

export const moveItemsSchema = itemsSchema
  .extend({
    /** null moves the items to the root. */
    destinationId: z.string().uuid('Dossier invalide').nullable(),
  })
  .refine(hasItems, 'Aucun élément sélectionné');

export const deleteItemsSchema = itemsSchema.refine(hasItems, 'Aucun élément sélectionné');

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Données invalides';
}

export function readScopeQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return Object.fromEntries(searchParams.entries());
}
