export const REALTIME_DOMAIN = {
  agenda: 'agenda',
  weeklyActivity: 'weeklyActivity',
  sales: 'sales',
  orders: 'orders',
} as const;

export type RealtimeDomain = (typeof REALTIME_DOMAIN)[keyof typeof REALTIME_DOMAIN];

export type RealtimeEnvelope<TPayload = unknown> = {
  domain: string;
  type: string;
  originClientId?: string;
  payload: TPayload;
};

export type RealtimeMutationMeta = {
  originClientId?: string;
};
