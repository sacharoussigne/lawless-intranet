import { isWeeklySalesRealtimeVisibleToViewer } from '@/lib/sales/realtime/visibility';
import type {
  WeeklySalesRealtimeEvent,
  WeeklySalesRealtimeViewerFilter,
} from '@/lib/sales/realtime/types';

type WeeklySalesRealtimeSubscriber = {
  send: (chunk: string) => void;
  filter: WeeklySalesRealtimeViewerFilter;
};

type WeeklySalesRealtimeHubGlobal = typeof globalThis & {
  __weeklySalesRealtimeChannels?: Map<string, Set<WeeklySalesRealtimeSubscriber>>;
};

function getChannels(): Map<string, Set<WeeklySalesRealtimeSubscriber>> {
  const globalStore = globalThis as WeeklySalesRealtimeHubGlobal;
  if (!globalStore.__weeklySalesRealtimeChannels) {
    globalStore.__weeklySalesRealtimeChannels = new Map();
  }
  return globalStore.__weeklySalesRealtimeChannels;
}

export function weeklySalesRealtimeChannelKey(dispensaryId: string): string {
  return `weeklySales:${dispensaryId}`;
}

export function formatWeeklySalesSseMessage(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function subscribeWeeklySalesRealtime(
  channelKey: string,
  filter: WeeklySalesRealtimeViewerFilter,
  send: (chunk: string) => void,
): () => void {
  const channels = getChannels();
  const subscriber: WeeklySalesRealtimeSubscriber = { send, filter };
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

export function broadcastWeeklySalesRealtime(
  channelKey: string,
  event: WeeklySalesRealtimeEvent,
): void {
  const subscribers = getChannels().get(channelKey);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const chunk = formatWeeklySalesSseMessage('change', JSON.stringify(event));
  for (const subscriber of subscribers) {
    if (!isWeeklySalesRealtimeVisibleToViewer(event, subscriber.filter)) {
      continue;
    }
    try {
      subscriber.send(chunk);
    } catch {
      // Connection may already be closed.
    }
  }
}
