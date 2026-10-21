import type { OrderEventRecord, OrderRecord } from '@lawless-intranet/types';

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
  companyGroup?: { id: string; name: string } | null;
  /** Filled by the order detail read. */
  createdBy?: OrderPerson | null;
  responsible?: OrderPerson | null;
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

/** Someone shown on an order (author, responsible, chatter): SSO profile with the business name. */
export interface OrderPerson {
  userId: string;
  name: string;
  image: string | null;
}

export interface OrderChatter {
  events: OrderEventRecord[];
  /** People named in the events (authors, responsibles), by user id. */
  people: Record<string, OrderPerson>;
}
