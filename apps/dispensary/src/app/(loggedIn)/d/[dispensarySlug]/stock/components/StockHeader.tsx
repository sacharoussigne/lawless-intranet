'use client';

import { Group, Button } from '@mantine/core';
import { IconTools, IconArrowsExchange, IconArrowsExchange2 } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';

interface StockHeaderProps {
  isEditing: boolean;
  canCraftReadOrWrite: boolean;
  canStockUpdate: boolean;
  onOpenCraft: () => void;
  onOpenTransfer: () => void;
  onOpenTake: () => void;
}

export function StockHeader({
  isEditing,
  canCraftReadOrWrite,
  canStockUpdate,
  onOpenCraft,
  onOpenTransfer,
  onOpenTake,
}: StockHeaderProps) {
  return (
    <PageHeader
      title="Stock"
      description="Inventaire par coffre, craft et transferts entre emplacements."
      actions={
        !isEditing ? (
          <Group>
            {canCraftReadOrWrite && (
              <Button
                leftSection={<IconTools size={16} />}
                onClick={onOpenCraft}
                variant="light"
              >
                Craft
              </Button>
            )}
            {canStockUpdate && (
              <Button
                leftSection={<IconArrowsExchange2 size={16} />}
                onClick={onOpenTake}
                variant="light"
                color="clay"
              >
                Prendre / Déposer
              </Button>
            )}
            {canStockUpdate && (
              <Button
                leftSection={<IconArrowsExchange size={16} />}
                onClick={onOpenTransfer}
                variant="light"
                color="leather"
              >
                Transférer
              </Button>
            )}
          </Group>
        ) : undefined
      }
    />
  );
}
