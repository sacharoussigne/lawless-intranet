export type OrdersRealtimeEvent = {
  type: 'orders';
  orderId: string;
  originClientId?: string;
};

export type OrdersMutationMeta = {
  originClientId?: string;
};
