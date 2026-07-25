import type { AgendaRealtimeEvent } from '@/lib/realtime/types';

type AgendaRealtimeSubscriber = {
  send: (chunk: string) => void;
};

type AgendaRealtimeHubGlobal = typeof globalThis & {
  __agendaRealtimeChannels?: Map<string, Set<AgendaRealtimeSubscriber>>;
};

function getChannels(): Map<string, Set<AgendaRealtimeSubscriber>> {
  const globalStore = globalThis as AgendaRealtimeHubGlobal;
  if (!globalStore.__agendaRealtimeChannels) {
    globalStore.__agendaRealtimeChannels = new Map();
  }
  return globalStore.__agendaRealtimeChannels;
}

export function formatSseMessage(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function subscribeAgendaRealtime(
  channelKey: string,
  send: (chunk: string) => void,
): () => void {
  const channels = getChannels();
  const subscriber: AgendaRealtimeSubscriber = { send };
  let subscribers = channels.get(channelKey);
  if (!subscribers) {
    subscribers = new Set();
    channels.set(channelKey, subscribers);
  }
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      channels.delete(channelKey);
    }
  };
}

export function broadcastAgendaRealtime(
  channelKey: string,
  event: AgendaRealtimeEvent,
): void {
  const subscribers = getChannels().get(channelKey);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const chunk = formatSseMessage('change', JSON.stringify(event));
  for (const subscriber of subscribers) {
    try {
      subscriber.send(chunk);
    } catch {
      // Connection may already be closed.
    }
  }
}

export function getAgendaRealtimeSubscriberCount(channelKey: string): number {
  return getChannels().get(channelKey)?.size ?? 0;
}
