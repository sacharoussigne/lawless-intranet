/** Topic names shared by publishers, the websocket server and token issuers. */
export const realtimeTopics = {
  /** Changes inside one agenda (events, todos, event todos). */
  agenda: (agendaId: string) => `agenda:${agendaId}`,
  /** Agenda list changes for a scope (create, rename, delete). */
  agendas: (scopeType: string, scopeId: string) => `agendas:${scopeType}:${scopeId}`,
  /** Per-user notifications (participant events, access changes). */
  user: (userId: string) => `user:${userId}`,
} as const;

const TOPIC_PATTERN = /^[a-z]+(:[A-Za-z0-9_-]+)+$/;

export function isValidRealtimeTopic(topic: unknown): topic is string {
  return typeof topic === 'string' && topic.length <= 200 && TOPIC_PATTERN.test(topic);
}
