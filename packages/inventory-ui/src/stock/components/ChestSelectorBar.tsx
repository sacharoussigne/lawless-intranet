'use client';

import { Badge, Button, Checkbox, Group, Select, Tooltip } from '@mantine/core';
import { IconCheck, IconEdit, IconEye, IconEyeOff, IconX } from '@tabler/icons-react';

interface ChestSelectorBarProps {
  chestOptions: { value: string; label: string }[];
  selectedChestId: string | null;
  isEditing: boolean;
  saving: boolean;
  skipHistory: boolean;
  totalWeightToday: number;
  itemsWithStockToday: number;
  lastStockLabel: string | null;
  canStockUpdate: boolean;
  canManageVisibility: boolean;
  isManagingVisibility: boolean;
  chestSelectLocked?: boolean;
  onChangeChestId: (value: string | null) => void;
  onToggleManagingVisibility: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onSkipHistoryChange: (value: boolean) => void;
}

export function ChestSelectorBar({
  chestOptions,
  selectedChestId,
  isEditing,
  saving,
  skipHistory,
  totalWeightToday,
  itemsWithStockToday,
  lastStockLabel,
  canStockUpdate,
  canManageVisibility,
  isManagingVisibility,
  chestSelectLocked = false,
  onChangeChestId,
  onToggleManagingVisibility,
  onStartEdit,
  onCancelEdit,
  onSave,
  onSkipHistoryChange,
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
          disabled={chestSelectLocked || isEditing || isManagingVisibility}
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
        {selectedChestId !== null && isEditing && canStockUpdate && (
          <>
            <Tooltip
              label="Aucun mouvement ne sera enregistré (ex. transfert manuel entre coffres sans utiliser Transférer)."
              multiline
              w={280}
            >
              <Checkbox
                label="Écraser (sans historique)"
                checked={skipHistory}
                onChange={(e) => onSkipHistoryChange(e.currentTarget.checked)}
              />
            </Tooltip>
            <Button
              leftSection={<IconX size={16} />}
              onClick={onCancelEdit}
              variant="subtle"
              color="slate"
            >
              Annuler
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={onSave}
              loading={saving}
              variant="filled"
              color="sage"
            >
              Sauvegarder
            </Button>
          </>
        )}

        {selectedChestId !== null && !isEditing && (
          <>
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
            {canStockUpdate && (
              <Button
                leftSection={<IconEdit size={16} />}
                onClick={onStartEdit}
                variant="light"
                disabled={isManagingVisibility}
              >
                {itemsWithStockToday > 0 ? 'Mettre à jour le stock' : 'Faire le stock'}
              </Button>
            )}
          </>
        )}
      </Group>
    </Group>
  );
}
