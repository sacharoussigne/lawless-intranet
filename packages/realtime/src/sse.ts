const DEFAULT_HEARTBEAT_MS = 30_000;

export type CreateSseResponseOptions = {
  request: Request;
  onStart: (send: (chunk: string) => void) => () => void;
  heartbeatMs?: number;
  headers?: HeadersInit;
};

export function createSseResponse(options: CreateSseResponseOptions): Response {
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      send(': connected\n\n');

      const unsubscribe = options.onStart(send);

      const heartbeat = setInterval(() => {
        try {
          send(': ping\n\n');
        } catch {
          clearInterval(heartbeat);
        }
      }, heartbeatMs);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream may already be closed.
        }
      };

      options.request.signal.addEventListener('abort', close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...options.headers,
    },
  });
}
