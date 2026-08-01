export type WeeklySalesRealtimeEvent = {
  type: 'weeklySales';
  saleId: string;
  ownerUserId: string;
  periodStart: string;
  periodEnd: string;
  originClientId?: string;
};

export type SalesMutationMeta = {
  originClientId?: string;
};

export type WeeklySalesRealtimeViewerFilter = {
  canViewAll: boolean;
  viewerUserId: string;
};
