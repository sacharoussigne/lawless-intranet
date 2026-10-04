import {
  INVENTORY_INTERNAL_SECRET_HEADER,
} from '@lawless-intranet/inventory-client';

export function isDispensaryRealtimeInternalPublisher(request: Request): boolean {
  const inventorySecret = process.env.INVENTORY_INTERNAL_SECRET;
  if (
    inventorySecret &&
    request.headers.get(INVENTORY_INTERNAL_SECRET_HEADER) === inventorySecret
  ) {
    return true;
  }

  return false;
}
