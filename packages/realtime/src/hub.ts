import { formatSseMessage } from './formatSse';

type RealtimeSubscriber<TFilter> = {
  send: (chunk: string) => void;
  filter: TFilter;
};

type HubGlobal = typeof globalThis & {
  [key: string]: Map<string, Set<RealtimeSubscriber<unknown>>> | undefined;
};

export type CreateRealtimeHubOptions<TEvent, TFilter> = {
  globalKey: string;
  sseEventName?: string;
  isVisible?: (event: TEvent, filter: TFilter) => boolean;
};

export type RealtimeHub<TEvent, TFilter = undefined> = {
  subscribe: (
    channelKey: string,
    send: (chunk: string) => void,
    filter?: TFilter,
  ) => () => void;
  broadcast: (channelKey: string, event: TEvent) => void;
  subscriberCount: (channelKey: string) => number;
};

export function createRealtimeHub<TEvent, TFilter = undefined>(
  options: CreateRealtimeHubOptions<TEvent, TFilter>,
): RealtimeHub<TEvent, TFilter> {
  const sseEventName = options.sseEventName ?? 'change';

  function getChannels(): Map<string, Set<RealtimeSubscriber<TFilter>>> {
    const globalStore = globalThis as HubGlobal;
    const existing = globalStore[options.globalKey] as
      | Map<string, Set<RealtimeSubscriber<TFilter>>>
      | undefined;
    if (existing) {
      return existing;
    }
    const created = new Map<string, Set<RealtimeSubscriber<TFilter>>>();
    globalStore[options.globalKey] = created as Map<
      string,
      Set<RealtimeSubscriber<unknown>>
    >;
    return created;
  }

  return {
    subscribe(channelKey, send, filter) {
      const channels = getChannels();
      const subscriber: RealtimeSubscriber<TFilter> = {
        send,
        filter: filter as TFilter,
      };
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
    },

    broadcast(channelKey, event) {
      const subscribers = getChannels().get(channelKey);
      if (!subscribers || subscribers.size === 0) {
        return;
      }

      const chunk = formatSseMessage(sseEventName, JSON.stringify(event));
      for (const subscriber of subscribers) {
        if (
          options.isVisible &&
          subscriber.filter !== undefined &&
          !options.isVisible(event, subscriber.filter)
        ) {
          continue;
        }
        try {
          subscriber.send(chunk);
        } catch {
          // Connection may already be closed.
        }
      }
    },

    subscriberCount(channelKey) {
      return getChannels().get(channelKey)?.size ?? 0;
    },
  };
}
