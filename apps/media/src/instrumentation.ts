/** Next.js startup hook: background maintenance of the media service (Node runtime only). */
export async function register() {
  // Keep this exact `if` shape: the bundler strips the import from the edge build only
  // when the condition is inlined, otherwise `pg` gets bundled for edge and `fs` fails to resolve.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startUploadsCleanup } = await import('@/lib/uploadsCleanup');
    startUploadsCleanup();
  }
}
