'use client';

import { useState } from 'react';
import { Button, Group } from '@mantine/core';
import { IconCash, IconHandGrab } from '@tabler/icons-react';
import { SaleModal } from '@/app/_components/sales/SaleModal';
import TakeModal from '@/app/(loggedIn)/d/[dispensarySlug]/stock/modals/TakeModal';
import type { ChestListItem } from '@/types/chests';

type EmployeeQuickActionsProps = {
  canCreateSale: boolean;
  canTakeStock: boolean;
  chests: ChestListItem[];
};

export function EmployeeQuickActions({
  canCreateSale,
  canTakeStock,
  chests,
}: EmployeeQuickActionsProps) {
  const [saleOpened, setSaleOpened] = useState(false);
  const [takeOpened, setTakeOpened] = useState(false);

  if (!canCreateSale && !canTakeStock) return null;

  return (
    <>
      <Group mb="lg">
        {canCreateSale && (
          <Button leftSection={<IconCash size={16} />} onClick={() => setSaleOpened(true)}>
            Vente
          </Button>
        )}
        {canTakeStock && (
          <Button
            leftSection={<IconHandGrab size={16} />}
            variant="light"
            color="clay"
            onClick={() => setTakeOpened(true)}
          >
            Prendre
          </Button>
        )}
      </Group>

      {canCreateSale && (
        <SaleModal opened={saleOpened} onClose={() => setSaleOpened(false)} chests={chests} />
      )}

      {canTakeStock && (
        <TakeModal
          opened={takeOpened}
          onClose={() => setTakeOpened(false)}
          chests={chests}
        />
      )}
    </>
  );
}
