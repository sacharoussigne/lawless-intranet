/** Next.js startup hook: background maintenance of the media service (Node runtime only). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startUploadsCleanup } = await import('@/lib/uploadsCleanup');
  startUploadsCleanup();
}
