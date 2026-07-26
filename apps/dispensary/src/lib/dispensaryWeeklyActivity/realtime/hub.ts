import { isWeeklyActivityRealtimeVisibleToViewer } from '@/lib/dispensaryWeeklyActivity/realtime/visibility';
import type {
  WeeklyActivityRealtimeEvent,
  WeeklyActivityRealtimeViewerFilter,
} from '@/lib/dispensaryWeeklyActivity/realtime/types';

type WeeklyActivityRealtimeSubscriber = {
  send: (chunk: string) => void;
  filter: WeeklyActivityRealtimeViewerFilter;
};

type WeeklyActivityRealtimeHubGlobal = typeof globalThis & {
  __weeklyActivityRealtimeChannels?: Map<string, Set<WeeklyActivityRealtimeSubscriber>>;
};

function getChannels(): Map<string, Set<WeeklyActivityRealtimeSubscriber>> {
  const globalStore = globalThis as WeeklyActivityRealtimeHubGlobal;
  if (!globalStore.__weeklyActivityRealtimeChannels) {
    globalStore.__weeklyActivityRealtimeChannels = new Map();
  }
  return globalStore.__weeklyActivityRealtimeChannels;
}

export function weeklyActivityRealtimeChannelKey(dispensaryId: string): string {
  return `weeklyActivity:${dispensaryId}`;
}

export function formatWeeklyActivitySseMessage(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function subscribeWeeklyActivityRealtime(
  channelKey: string,
  filter: WeeklyActivityRealtimeViewerFilter,
  send: (chunk: string) => void,
): () => void {
  const channels = getChannels();
  const subscriber: WeeklyActivityRealtimeSubscriber = { send, filter };
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

export function broadcastWeeklyActivityRealtime(
  channelKey: string,
  event: WeeklyActivityRealtimeEvent,
): void {
  const subscribers = getChannels().get(channelKey);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const chunk = formatWeeklyActivitySseMessage('change', JSON.stringify(event));
  for (const subscriber of subscribers) {
    if (!isWeeklyActivityRealtimeVisibleToViewer(event, subscriber.filter)) {
      continue;
    }
    try {
      subscriber.send(chunk);
    } catch {
      // Connection may already be closed.
    }
  }
}
