/** Topic names shared by publishers, the websocket server and token issuers. */
export const realtimeTopics = {
  /** Changes inside one agenda (events, todos, event todos). */
  agenda: (agendaId: string) => `agenda:${agendaId}`,
  /** Agenda list changes for a scope (create, rename, delete). */
  agendas: (scopeType: string, scopeId: string) => `agendas:${scopeType}:${scopeId}`,
  /** Orders of a business (create, update, status, delete). */
  orders: (businessId: string) => `orders:${businessId}`,
  /** Every sale of a business (viewers with `sales:view_all`). */
  sales: (businessId: string) => `sales:${businessId}`,
  /** Sales of one seller in a business (the seller, with `sales:view`). */
  salesOfUser: (businessId: string, userId: string) => `sales:${businessId}:user:${userId}`,
  /** Every weekly activity of a business (viewers with `edit_all`). */
  weeklyActivity: (businessId: string) => `weeklyactivity:${businessId}`,
  /** Weekly activity of one member in a business (the member, with `view`). */
  weeklyActivityOfUser: (businessId: string, userId: string) =>
    `weeklyactivity:${businessId}:user:${userId}`,
  /** Animal waitlist of a shelter (viewers with `waitlist:manage`). */
  waitlist: (shelterId: string) => `waitlist:${shelterId}`,
  /** Stock of a business (quantities, movements, crafts, items and chests): viewers with `stock:view`. */
  stock: (businessId: string) => `stock:${businessId}`,
  /** Media library of a scope (folders and files). */
  media: (scopeType: string, scopeId: string) => `media:${scopeType}:${scopeId}`,
  /** Per-user notifications (participant events, access changes). */
  user: (userId: string) => `user:${userId}`,
} as const;

const TOPIC_PATTERN = /^[a-z]+(:[A-Za-z0-9_-]+)+$/;

export function isValidRealtimeTopic(topic: unknown): topic is string {
  return typeof topic === 'string' && topic.length <= 200 && TOPIC_PATTERN.test(topic);
}
