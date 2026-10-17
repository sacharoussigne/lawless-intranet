'use client';

import { usePermissions, useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { useStockRealtimeInvalidation } from '@/lib/stock/realtime/client/useStockRealtimeInvalidation';

/** Keeps every stock screen of the dispensary up to date (topic given by the realtime token). */
export function StockRealtimeBridge() {
  const { appSettings, permissions } = usePermissions();
  const slug = useRequiredDispensarySlug();
  const enabled = appSettings.featureStockEnabled && Boolean(permissions?.stock.view);

  useStockRealtimeInvalidation(slug, enabled);
  return null;
}
