import {
  AGENDA_INTERNAL_SECRET_HEADER,
} from '@lawless-intranet/agenda-client';
import {
  INVENTORY_INTERNAL_SECRET_HEADER,
} from '@lawless-intranet/inventory-client';

export function isDispensaryRealtimeInternalPublisher(request: Request): boolean {
  const agendaSecret = process.env.AGENDA_INTERNAL_SECRET;
  if (
    agendaSecret &&
    request.headers.get(AGENDA_INTERNAL_SECRET_HEADER) === agendaSecret
  ) {
    return true;
  }

  const inventorySecret = process.env.INVENTORY_INTERNAL_SECRET;
  if (
    inventorySecret &&
    request.headers.get(INVENTORY_INTERNAL_SECRET_HEADER) === inventorySecret
  ) {
    return true;
  }

  return false;
}
