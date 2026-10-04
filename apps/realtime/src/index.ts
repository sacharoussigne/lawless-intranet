import { loadConfig, type RealtimeServerConfig } from './config';
import { createRealtimeServer } from './server';

function loadConfigOrIdle(): RealtimeServerConfig | null {
  try {
    return loadConfig();
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    // In `pnpm dev`, a missing apps/realtime/.env must not stop the other apps.
    console.error(
      `[realtime] ${error instanceof Error ? error.message : String(error)}\n` +
        '[realtime] Server disabled: copy apps/realtime/.env.example to apps/realtime/.env (same secrets as dispensary and agenda).',
    );
    return null;
  }
}

const config = loadConfigOrIdle();

if (!config) {
  // Keep the dev task alive; restart `pnpm dev` once .env is created.
  setInterval(() => {}, 1 << 30);
} else {
  const server = createRealtimeServer(config);

  const { wsPort, internalPort } = await server.start();
  console.warn(
    `[realtime] websocket on :${wsPort}, internal API on :${internalPort}` +
      (config.allowedOrigins.length > 0 ? '' : ' (any origin allowed)'),
  );

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.warn(`[realtime] ${signal} received, shutting down`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
