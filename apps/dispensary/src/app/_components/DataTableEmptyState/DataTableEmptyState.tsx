'use client';

import { Stack, Text } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

type DataTableEmptyStateProps = {
  icon: TablerIcon;
  message: string;
};

export function DataTableEmptyState({ icon: Icon, message }: DataTableEmptyStateProps) {
  return (
    <Stack align="center" gap="xs" py="xl">
      <Icon size={40} stroke={1.5} style={{ color: 'var(--mantine-color-dimmed)' }} />
      <Text size="sm" c="dimmed" fw={500} ta="center">
        {message}
      </Text>
    </Stack>
  );
}
