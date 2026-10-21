import { ACTIVE_ORDER_STATUSES } from '@/lib/orders/orderSelectOptions';

export type OrdersPageFilters = {
  page: number;
  pageSize: number;
  status: string[];
  type: string | null;
  search: string;
  createdAtFrom: string | null;
  createdAtTo: string | null;
};

export const DEFAULT_ORDERS_PAGE_SIZE = 10;

export const defaultOrdersPageFilters: OrdersPageFilters = {
  page: 1,
  pageSize: DEFAULT_ORDERS_PAGE_SIZE,
  status: [],
  type: null,
  search: '',
  createdAtFrom: null,
  createdAtTo: null,
};

export const defaultActiveOrdersPageFilters: OrdersPageFilters = {
  ...defaultOrdersPageFilters,
  pageSize: 5,
  status: [...ACTIVE_ORDER_STATUSES],
};

export const ordersKeys = {
  all: (slug: string) => ['orders', slug] as const,
  page: (slug: string, filters: OrdersPageFilters) =>
    [...ordersKeys.all(slug), 'page', filters] as const,
  detail: (slug: string, orderId: string) =>
    [...ordersKeys.all(slug), 'detail', orderId] as const,
  activeByGroup: (slug: string, companyGroupId: string) =>
    [...ordersKeys.all(slug), 'activeByGroup', companyGroupId] as const,
  letterAssignments: (slug: string) =>
    [...ordersKeys.all(slug), 'letterAssignments'] as const,
  formItems: (slug: string, companyGroupId: string | null) =>
    [...ordersKeys.all(slug), 'formItems', companyGroupId] as const,
};
