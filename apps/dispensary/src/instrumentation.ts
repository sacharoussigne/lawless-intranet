/** Next.js startup hook (Node runtime only): app log error reporter and log retention. */
export async function register() {
  // Keep this exact `if` shape: the bundler strips the imports from the edge build only
  // when the condition is inlined, otherwise `pg` gets bundled for edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerServerErrorReporter } = await import('@/lib/logs/errorReporter');
    const { logServerError } = await import('@/lib/logs/writer');
    const { startAppLogRetention } = await import('@/lib/logs/retention');
    registerServerErrorReporter(logServerError);
    startAppLogRetention();
  }
}
