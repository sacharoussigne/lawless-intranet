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
import { createDispensaryInventoryActions } from '@/lib/inventory/inventoryUiActions';
import { usePermissions } from '@/app/_contexts/PermissionsContext';

type DispensaryStockWorkspaceProps = {
  dispensarySlug: string;
  initialItems: ItemWithRelations[];
  initialChests: ChestListItem[];
  initialStockChecksSummary: StockChecksSummary;
  stockUiPreferences: StockUiPreferences;
  initialLastStockDaysByChest: Record<string, Date | null>;
};

export function DispensaryStockWorkspace({
  dispensarySlug,
  initialItems,
  initialChests,
  initialStockChecksSummary,
  stockUiPreferences,
  initialLastStockDaysByChest,
}: DispensaryStockWorkspaceProps) {
  const { permissions } = usePermissions();
  const actions = useMemo(
    () => createDispensaryInventoryActions(dispensarySlug),
    [dispensarySlug],
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
      scopeKey={dispensarySlug}
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
