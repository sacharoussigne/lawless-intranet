import { loadConfig } from './config';
import { createRealtimeServer } from './server';

const config = loadConfig();
const server = createRealtimeServer(config);

const { wsPort, internalPort } = await server.start();
console.warn(
  `[realtime] websocket on :${wsPort}, internal API on :${internalPort}` +
    (config.allowedOrigins.length > 0 ? '' : ' (any origin allowed)'),
);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.warn(`[realtime] ${signal} received, shutting down`);
  await server.stop();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
