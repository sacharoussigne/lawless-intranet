'use client';

import { Badge, Button, Group, Select } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

interface ChestSelectorBarProps {
  chestOptions: { value: string; label: string }[];
  selectedChestId: string | null;
  isEditing: boolean;
  totalWeightToday: number;
  itemsWithStockToday: number;
  totalItems: number;
  lastStockLabel: string | null;
  canManageVisibility: boolean;
  isManagingVisibility: boolean;
  onChangeChestId: (value: string | null) => void;
  onToggleManagingVisibility: () => void;
}

export function ChestSelectorBar({
  chestOptions,
  selectedChestId,
  isEditing,
  totalWeightToday,
  itemsWithStockToday,
  totalItems,
  lastStockLabel,
  canManageVisibility,
  isManagingVisibility,
  onChangeChestId,
  onToggleManagingVisibility,
}: ChestSelectorBarProps) {
  return (
    <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
      <Group gap="md" wrap="nowrap">
        <Select
          placeholder="Sélectionner un coffre"
          data={chestOptions}
          value={selectedChestId || ''}
          onChange={(value) => onChangeChestId(value === '' ? null : value)}
          clearable={false}
          disabled={isEditing || isManagingVisibility}
          style={{ minWidth: 200 }}
        />

        {lastStockLabel && (
          <Badge color="amber" variant="light" size="lg">
            {lastStockLabel}
          </Badge>
        )}

        {totalWeightToday > 0 && (
          <Badge color="denim" variant="light" size="lg">
            Poids {selectedChestId === null ? 'total' : ''} (aujourd&apos;hui) : {totalWeightToday.toFixed(2)} kg
          </Badge>
        )}
      </Group>

      <Group gap="md" wrap="nowrap">
        {itemsWithStockToday > 0 && (
          <Badge
            color={itemsWithStockToday === totalItems ? 'sage' : 'amber'}
            variant="light"
            size="lg"
          >
            {itemsWithStockToday}/{totalItems} objets stockés aujourd&apos;hui
          </Badge>
        )}

        {canManageVisibility && (
          <Button
            variant={isManagingVisibility ? 'filled' : 'light'}
            color="slate"
            leftSection={isManagingVisibility ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            onClick={onToggleManagingVisibility}
          >
            {isManagingVisibility ? 'Terminer' : 'Masquer'}
          </Button>
        )}
      </Group>
    </Group>
  );
}
