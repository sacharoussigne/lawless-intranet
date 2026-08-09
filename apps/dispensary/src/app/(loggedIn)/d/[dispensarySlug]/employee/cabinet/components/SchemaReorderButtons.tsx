'use client';

import { ActionIcon, Group } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';

type SchemaReorderButtonsProps = {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: 'up' | 'down') => void;
  size?: 'sm' | 'xs';
};

export function SchemaReorderButtons({
  canMoveUp,
  canMoveDown,
  onMove,
  size = 'sm',
}: SchemaReorderButtonsProps) {
  const iconSize = size === 'xs' ? 12 : 14;

  return (
    <Group gap={2} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        color="slate"
        size={size}
        disabled={!canMoveUp}
        onClick={() => onMove('up')}
        aria-label="Monter"
      >
        <IconArrowUp size={iconSize} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="slate"
        size={size}
        disabled={!canMoveDown}
        onClick={() => onMove('down')}
        aria-label="Descendre"
      >
        <IconArrowDown size={iconSize} />
      </ActionIcon>
    </Group>
  );
}
