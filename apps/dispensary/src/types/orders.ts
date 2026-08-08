import type { OrderRecord } from '@lawless-intranet/types';

export interface OrderItem {
  id?: string;
  itemId: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    price: number | null;
    weight?: number | null;
    isEnabled?: boolean;
  };
}

export interface OrderWithRelations
  extends Omit<
    OrderRecord,
    'items' | 'company' | 'individualCustomer' | 'companyGroup' | 'itemCount' | '_count'
  > {
  price: number | null;
  company: {
    id: string;
    name: string;
    bankAccountNumber?: string | null;
  } | null;
  individualCustomer: {
    id: string;
    name: string;
  } | null;
  items: OrderItem[];
}

export interface OrderSummary extends Omit<OrderWithRelations, 'items'> {
  itemCount: number;
}

export interface OrdersPageResult {
  orders: OrderSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ActiveOrderSummary {
  id: string;
  name: string;
  status: string;
  companyGroupId?: string | null;
  company: {
    id: string;
    name: string;
  } | null;
  individualCustomer?: {
    id: string;
    name: string;
  } | null;
  items: Array<{
    itemId: string;
    quantity: number;
    item: {
      id: string;
      name: string;
    };
  }>;
}

export function getOrderClientDisplayName(
  order: Pick<OrderWithRelations, 'company' | 'individualCustomer'>
): string {
  return order.individualCustomer?.name ?? order.company?.name ?? '—';
}
