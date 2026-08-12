'use client';

import { Paper, Flex, Badge, ActionIcon, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

export interface Filter {
  label: string;
  value: string | null;
  onRemove: () => void;
  displayValue?: string;
}

interface ActiveFiltersProps {
  filters: Filter[];
}

export function ActiveFilters({ filters }: ActiveFiltersProps) {
  const activeFilters = filters.filter((filter) => filter.value !== null && filter.value !== '');

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <Paper shadow="sm" p="md" withBorder mb="md">
      <Flex align="center" gap="md" wrap="wrap">
        <Text fw={500}>Filtres :</Text>
        {activeFilters.map((filter) => (
          <Badge
            key={filter.label}
            variant="light"
            color="terracotta"
            size="lg"
            rightSection={
              <ActionIcon
                size="xs"
                color="slate"
                radius="xl"
                variant="subtle"
                onClick={filter.onRemove}
                aria-label={`Retirer le filtre ${filter.label}`}
              >
                <IconX size={12} />
              </ActionIcon>
            }
          >
            {filter.label}: {filter.displayValue ?? filter.value}
          </Badge>
        ))}
      </Flex>
    </Paper>
  );
}
