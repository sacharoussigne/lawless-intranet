import {
  createServiceFetch,
  ServiceClientError,
  toQuery,
  type ServiceFetchOptions,
} from '@lawless-intranet/service-client';

export const INVENTORY_INTERNAL_SECRET_HEADER = 'x-inventory-internal-secret';

export class InventoryClientError extends ServiceClientError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = 'InventoryClientError';
  }
}

const client = createServiceFetch({
  label: 'Inventory',
  urlEnv: 'INVENTORY_URL',
  defaultUrl: 'http://localhost:3005',
  secretEnv: 'INVENTORY_INTERNAL_SECRET',
  secretHeader: INVENTORY_INTERNAL_SECRET_HEADER,
  createError: (message, status) => new InventoryClientError(message, status),
});

export const getInventoryUrl = client.getUrl;
export const parseJsonResponse = client.parseJsonResponse;
export { toQuery };

export type InventoryFetchOptions = ServiceFetchOptions;
export const inventoryFetch = client.fetch;
/** Same as `toQuery` (arrays are always repeated); kept for existing call sites. */
export const toQueryWithArray = toQuery;
