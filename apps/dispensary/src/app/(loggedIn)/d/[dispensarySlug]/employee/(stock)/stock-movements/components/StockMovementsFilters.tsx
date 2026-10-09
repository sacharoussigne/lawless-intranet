'use client';

import { Paper, Select, SimpleGrid, Title } from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { parsePickerDate } from '@/lib/date';
import { STOCK_MOVEMENT_KIND_OPTIONS } from '@/lib/stock/movements';
import type { StockMovementChestFilter } from '@/types/stock';

export type StockMovementsSharedFilters = {
  itemId: string | null;
  chestFilter: StockMovementChestFilter;
  kind: string | null;
  from: string;
  to: string;
};

type StockMovementsFiltersProps = {
  itemOptions: { value: string; label: string }[];
  chestOptions: { value: string; label: string }[];
  filters: StockMovementsSharedFilters;
  onChange: (patch: Partial<StockMovementsSharedFilters>) => void;
};

export function StockMovementsFilters({
  itemOptions,
  chestOptions,
  filters,
  onChange,
}: StockMovementsFiltersProps) {
  const dateRange: [Date | null, Date | null] = [
    filters.from ? new Date(filters.from) : null,
    filters.to ? new Date(filters.to) : null,
  ];

  return (
    <Paper shadow="sm" p="md" withBorder>
      <Title order={4} mb="md" className="disp-display-title">
        Filtres
      </Title>
      <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Select
            label="Item"
            placeholder="Tous les items"
            data={itemOptions}
            value={filters.itemId}
            onChange={(value) => onChange({ itemId: value })}
            searchable
            clearable
          />
          <Select
            label="Coffre"
            data={chestOptions}
            value={filters.chestFilter}
            onChange={(value) =>
              onChange({ chestFilter: (value ?? 'all') as StockMovementChestFilter })
            }
          />
          <Select
            label="Type de mouvement"
            placeholder="Tous les types"
            data={STOCK_MOVEMENT_KIND_OPTIONS}
            value={filters.kind}
            onChange={(value) => onChange({ kind: value })}
            clearable
          />
          <DatePickerInput
            type="range"
            label="Période"
            placeholder="Choisir une période"
            value={dateRange}
            onChange={(value) => {
              const [rawFrom, rawTo] = (value ?? [null, null]) as [
                Date | string | null,
                Date | string | null,
              ];
              const from = parsePickerDate(rawFrom);
              const to = parsePickerDate(rawTo);
              onChange({
                from: from?.toISOString() ?? '',
                to: to?.toISOString() ?? '',
              });
            }}
            valueFormat="D MMM YYYY"
            clearable={false}
          />
        </SimpleGrid>
      </DatesProvider>
    </Paper>
  );
}
