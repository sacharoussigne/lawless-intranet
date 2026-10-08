import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildContentDisposition } from '@/lib/names';

/**
 * S3 storage (AWS, or any S3-compatible endpoint via S3_ENDPOINT).
 * The service still starts without configuration: browsing works, uploads
 * and signed URLs are unavailable (see isStorageConfigured).
 */
export const UPLOAD_TICKET_TTL_SECONDS = 15 * 60;
export const READ_URL_TTL_SECONDS = 60 * 60;
const DELETE_BATCH_SIZE = 1000;

type StorageConfig = {
  bucket: string;
  client: S3Client;
};

const globalForS3 = globalThis as unknown as { __mediaStorage?: StorageConfig | null };

function readConfig(): StorageConfig | null {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  if (!bucket || !region) return null;

  const client = new S3Client({
    region,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    // Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (default provider chain).
  });
  return { bucket, client };
}

function getStorage(): StorageConfig | null {
  if (globalForS3.__mediaStorage === undefined) {
    globalForS3.__mediaStorage = readConfig();
  }
  return globalForS3.__mediaStorage;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Stockage non configuré (S3_BUCKET / S3_REGION manquants)');
  }
}

function requireStorage(): StorageConfig {
  const storage = getStorage();
  if (!storage) throw new StorageNotConfiguredError();
  return storage;
}

export function isStorageConfigured(): boolean {
  return getStorage() !== null;
}

/** Presigned multipart POST: S3 itself enforces the key, content type and size. */
export async function createUploadTicket(input: {
  key: string;
  mimeType: string;
  maxSizeBytes: number;
}): Promise<{ url: string; fields: Record<string, string>; expiresAt: Date }> {
  const { bucket, client } = requireStorage();
  const { url, fields } = await createPresignedPost(client, {
    Bucket: bucket,
    Key: input.key,
    Conditions: [
      ['content-length-range', 1, input.maxSizeBytes],
      ['eq', '$Content-Type', input.mimeType],
    ],
    Fields: { 'Content-Type': input.mimeType },
    Expires: UPLOAD_TICKET_TTL_SECONDS,
  });
  return { url, fields, expiresAt: new Date(Date.now() + UPLOAD_TICKET_TTL_SECONDS * 1000) };
}

export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  const { bucket, client } = requireStorage();
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

/** Signed GET URL; `download` forces the display name as attachment. */
export async function signReadUrl(input: {
  key: string;
  fileName: string;
  download?: boolean;
}): Promise<{ url: string; expiresAt: Date }> {
  const { bucket, client } = requireStorage();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ResponseContentDisposition: buildContentDisposition(
        input.fileName,
        input.download ? 'attachment' : 'inline',
      ),
    }),
    { expiresIn: READ_URL_TTL_SECONDS },
  );
  return { url, expiresAt: new Date(Date.now() + READ_URL_TTL_SECONDS * 1000) };
}

/** Best effort: failures are logged, the database stays the source of truth. */
export async function deleteObjects(keys: readonly string[]): Promise<void> {
  const storage = getStorage();
  if (!storage || keys.length === 0) return;
  for (let index = 0; index < keys.length; index += DELETE_BATCH_SIZE) {
    const batch = keys.slice(index, index + DELETE_BATCH_SIZE);
    try {
      const result = await storage.client.send(
        new DeleteObjectsCommand({
          Bucket: storage.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      if (result.Errors && result.Errors.length > 0) {
        console.error('[media] some S3 objects could not be deleted', result.Errors.slice(0, 5));
      }
    } catch (error) {
      console.error('[media] S3 delete failed', error);
    }
  }
}

/** Deletes every object under a prefix (tenant purge, including orphans). */
export async function deletePrefix(prefix: string): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  let continuationToken: string | undefined;
  do {
    const page = await storage.client.send(
      new ListObjectsV2Command({
        Bucket: storage.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    const keys = (page.Contents ?? []).map((object) => object.Key).filter((key): key is string => Boolean(key));
    await deleteObjects(keys);
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
}
