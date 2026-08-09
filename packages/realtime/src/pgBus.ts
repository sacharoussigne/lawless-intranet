import { Client } from 'pg';

type PgListenerGlobal = typeof globalThis & {
  [key: string]: Promise<void> | undefined;
};

export type CreatePgNotifyListenerOptions<TPayload> = {
  globalKey: string;
  channel: string;
  connectionString?: string;
  onPayload: (payload: TPayload) => void;
  logLabel?: string;
};

export type PgNotifyListener = {
  ensureListener: () => Promise<void>;
};

export function createPgNotifyListener<TPayload>(
  options: CreatePgNotifyListenerOptions<TPayload>,
): PgNotifyListener {
  const logLabel = options.logLabel ?? options.channel;

  return {
    async ensureListener() {
      const globalStore = globalThis as PgListenerGlobal;
      if (globalStore[options.globalKey]) {
        return globalStore[options.globalKey];
      }

      const connectionString =
        options.connectionString ?? process.env.DATABASE_URL;
      if (!connectionString) {
        return;
      }

      globalStore[options.globalKey] = (async () => {
        const client = new Client({ connectionString });
        await client.connect();
        await client.query(`LISTEN ${options.channel}`);

        client.on('notification', (message) => {
          if (!message.payload) return;

          try {
            const payload = JSON.parse(message.payload) as TPayload;
            options.onPayload(payload);
          } catch {
            // Ignore malformed payloads.
          }
        });

        client.on('error', (error) => {
          console.error(`[${logLabel}] PostgreSQL listener error`, error);
          globalStore[options.globalKey] = undefined;
        });
      })();

      return globalStore[options.globalKey];
    },
  };
}
