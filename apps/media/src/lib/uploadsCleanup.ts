import prisma from '@/lib/prisma';
import { abandonedUploadsCutoff } from '@/lib/limits';
import { deleteObjects } from '@/lib/s3';

/**
 * Abandoned uploads (tab closed, network lost before « complete ») leave an
 * UPLOADING row and sometimes an orphan S3 object: removed hourly.
 */
export const UPLOADS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 500;

/** Deletes stale UPLOADING files (database, then S3 best effort), batch by batch. */
export async function cleanupAbandonedUploads(now = new Date()): Promise<{ files: number }> {
  const cutoff = abandonedUploadsCutoff(now);
  let total = 0;

  for (;;) {
    const stale = await prisma.mediaFile.findMany({
      where: { status: 'UPLOADING', createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
      take: CLEANUP_BATCH_SIZE,
    });
    if (stale.length === 0) break;

    // Status re-checked: an upload completed meanwhile is kept.
    await prisma.mediaFile.deleteMany({
      where: { id: { in: stale.map((file) => file.id) }, status: 'UPLOADING' },
    });
    await deleteObjects(stale.map((file) => file.storageKey));
    total += stale.length;
    if (stale.length < CLEANUP_BATCH_SIZE) break;
  }

  if (total > 0) console.warn(`[media] cleaned ${total} abandoned upload(s)`);
  return { files: total };
}

const globalForCleanup = globalThis as unknown as { __mediaUploadsCleanup?: NodeJS.Timeout };

/** Runs the cleanup now and every hour, once per process (dev reloads included). */
export function startUploadsCleanup(): void {
  if (globalForCleanup.__mediaUploadsCleanup) return;

  const run = () => {
    cleanupAbandonedUploads().catch((error: unknown) => {
      console.error('[media] abandoned uploads cleanup failed', error);
    });
  };

  run();
  const timer = setInterval(run, UPLOADS_CLEANUP_INTERVAL_MS);
  timer.unref();
  globalForCleanup.__mediaUploadsCleanup = timer;
}
