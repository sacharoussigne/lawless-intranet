'use client';

import { usePermissions, useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import { useStockRealtimeInvalidation } from '@/lib/stock/realtime/client/useStockRealtimeInvalidation';

/** Keeps every stock screen of the dispensary up to date (topic given by the realtime token). */
export function StockRealtimeBridge() {
  const { appSettings, permissions } = usePermissions();
  const slug = useRequiredBusinessSlug();
  const enabled = appSettings.featureStockEnabled && Boolean(permissions?.stock.view);

  useStockRealtimeInvalidation(slug, enabled);
  return null;
}
