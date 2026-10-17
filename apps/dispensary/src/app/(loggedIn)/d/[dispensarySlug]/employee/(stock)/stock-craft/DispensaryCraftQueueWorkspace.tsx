'use client';

import { useMemo } from 'react';
import { Alert, Container } from '@mantine/core';
import {
  CraftQueuePage,
  InventoryUiProvider,
  type ChestListItem,
  type InventoryUiPermissions,
} from '@lawless-intranet/inventory-ui';
import { createDispensaryInventoryActions } from '@/lib/inventory/inventoryUiActions';
import { usePermissions } from '@/app/_contexts/PermissionsContext';

type DispensaryCraftQueueWorkspaceProps = {
  dispensarySlug: string;
  chests: ChestListItem[];
};

export function DispensaryCraftQueueWorkspace({ dispensarySlug, chests }: DispensaryCraftQueueWorkspaceProps) {
  const { permissions } = usePermissions();
  const actions = useMemo(() => createDispensaryInventoryActions(dispensarySlug), [dispensarySlug]);

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

  if (!inventoryPermissions.stock.craftRead && !inventoryPermissions.stock.craftWrite) {
    return (
      <Container size="xl" py="xl">
        <Alert color="danger">Vous n&apos;avez pas accès aux crafts.</Alert>
      </Container>
    );
  }

  return (
    <InventoryUiProvider scopeKey={dispensarySlug} actions={actions} permissions={inventoryPermissions}>
      <CraftQueuePage chests={chests} />
    </InventoryUiProvider>
  );
}
