import type { RealtimeEnvelope } from '@lawless-intranet/realtime';

/** One authenticated browser connection. */
export type HubConnection = {
  id: string;
  userId: string;
  topics: Set<string>;
  deliver: (topic: string, envelope: RealtimeEnvelope) => void;
};

/**
 * In-memory topic registry (single instance). Scaling to several instances
 * would require a shared bus (pg NOTIFY / redis) in front of `publish`.
 */
export class RealtimeHub {
  private readonly byTopic = new Map<string, Set<HubConnection>>();
  private readonly byUser = new Map<string, Set<HubConnection>>();

  /** Replaces the topic set of a connection (initial auth or token refresh). */
  setTopics(connection: HubConnection, topics: Iterable<string>): void {
    this.removeTopics(connection, [...connection.topics]);
    for (const topic of topics) {
      connection.topics.add(topic);
      let subscribers = this.byTopic.get(topic);
      if (!subscribers) {
        subscribers = new Set();
        this.byTopic.set(topic, subscribers);
      }
      subscribers.add(connection);
    }

    let userConnections = this.byUser.get(connection.userId);
    if (!userConnections) {
      userConnections = new Set();
      this.byUser.set(connection.userId, userConnections);
    }
    userConnections.add(connection);
  }

  remove(connection: HubConnection): void {
    this.removeTopics(connection, [...connection.topics]);
    const userConnections = this.byUser.get(connection.userId);
    userConnections?.delete(connection);
    if (userConnections?.size === 0) {
      this.byUser.delete(connection.userId);
    }
  }

  /** Delivers the envelope once per connection subscribed to any of the topics. */
  publish(topics: readonly string[], envelope: RealtimeEnvelope): number {
    const delivered = new Set<HubConnection>();
    for (const topic of topics) {
      const subscribers = this.byTopic.get(topic);
      if (!subscribers) continue;
      for (const connection of subscribers) {
        if (delivered.has(connection)) continue;
        delivered.add(connection);
        try {
          connection.deliver(topic, envelope);
        } catch (error) {
          console.error('[realtime] delivery failed', error);
        }
      }
    }
    return delivered.size;
  }

  /** Removes topics from every connection of a user (access revoked). */
  revoke(userId: string, topics: readonly string[]): number {
    const connections = this.byUser.get(userId);
    if (!connections) return 0;
    for (const connection of connections) {
      this.removeTopics(connection, topics);
    }
    return connections.size;
  }

  stats(): { connections: number; users: number; topics: number } {
    let connections = 0;
    for (const set of this.byUser.values()) connections += set.size;
    return { connections, users: this.byUser.size, topics: this.byTopic.size };
  }

  private removeTopics(connection: HubConnection, topics: readonly string[]): void {
    for (const topic of topics) {
      connection.topics.delete(topic);
      const subscribers = this.byTopic.get(topic);
      subscribers?.delete(connection);
      if (subscribers?.size === 0) {
        this.byTopic.delete(topic);
      }
    }
  }
}
