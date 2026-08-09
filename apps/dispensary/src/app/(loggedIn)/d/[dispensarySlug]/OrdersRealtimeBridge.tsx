'use client';

import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { useOrdersRealtimeInvalidation } from './orders/hooks/useOrdersQueries';

export function OrdersRealtimeBridge() {
  const { appSettings, permissions } = usePermissions();
  const enabled =
    appSettings.featureOrdersEnabled && Boolean(permissions?.orders.view);

  useOrdersRealtimeInvalidation(enabled);
  return null;
}
