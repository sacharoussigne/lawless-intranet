'use client';

import { useMemo } from 'react';
import {
  InventoryUiProvider,
  StockPage,
  type ChestListItem,
  type InventoryUiPermissions,
  type ItemWithRelations,
  type StockChecksSummary,
  type StockUiPreferences,
} from '@lawless-intranet/inventory-ui';
import { createBusinessInventoryActions } from '@/lib/inventory/inventoryUiActions';
import { useOptionalRealtimeSocket } from '@lawless-intranet/realtime/socket';
import { usePermissions } from '@/app/_contexts/PermissionsContext';

type BusinessStockWorkspaceProps = {
  businessSlug: string;
  initialItems: ItemWithRelations[];
  initialChests: ChestListItem[];
  initialStockChecksSummary: StockChecksSummary;
  stockUiPreferences: StockUiPreferences;
  initialLastStockDaysByChest: Record<string, Date | null>;
};

export function BusinessStockWorkspace({
  businessSlug,
  initialItems,
  initialChests,
  initialStockChecksSummary,
  stockUiPreferences,
  initialLastStockDaysByChest,
}: BusinessStockWorkspaceProps) {
  const { permissions } = usePermissions();
  const clientId = useOptionalRealtimeSocket()?.clientId ?? null;
  const actions = useMemo(
    () => createBusinessInventoryActions(businessSlug, clientId),
    [businessSlug, clientId],
  );

  const inventoryPermissions: InventoryUiPermissions = useMemo(
    () => ({
      stock: {
        update: Boolean(permissions?.stock.update),
        hide: Boolean(permissions?.stock.hide),
        craftRead: Boolean(permissions?.stock.craftRead),
        craftWrite: Boolean(permissions?.stock.craftWrite),
      },
    }),
    [permissions],
  );

  return (
    <InventoryUiProvider
      scopeKey={businessSlug}
      actions={actions}
      permissions={inventoryPermissions}
    >
      <StockPage
        initialItems={initialItems}
        initialChests={initialChests}
        initialStockChecksSummary={initialStockChecksSummary}
        stockUiPreferences={stockUiPreferences}
        initialLastStockDaysByChest={initialLastStockDaysByChest}
      />
    </InventoryUiProvider>
  );
}
