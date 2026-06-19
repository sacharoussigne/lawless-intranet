'use client';

import { useMemo, useState } from 'react';
import { Container, Stack, Text, Title } from '@mantine/core';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { getMondayOfCurrentWeek, getTodayStart } from '@/lib/date';
import type { StockMovementListItem, StockMovementsPageResult } from '@/types/stock';
import {
  defaultStockMovementsPageFilters,
  useChestsListForMovements,
  useItemsListForMovements,
  useStockMovementReconciliation,
  useStockMovementsPage,
} from './hooks/useStockMovementsQueries';
import { StockMovementsFilters, type StockMovementsSharedFilters } from './components/StockMovementsFilters';
import { StockMovementsTable } from './components/StockMovementsTable';
import { EditMovementModal } from './components/EditMovementModal';
import { DeleteMovementModal } from './components/DeleteMovementModal';
import { ReconciliationPanel } from './components/ReconciliationPanel';

interface StockMovementsPageClientProps {
  initialPage?: StockMovementsPageResult;
}

function buildPageFilters(
  shared: StockMovementsSharedFilters,
  page: number,
) {
  return {
    ...defaultStockMovementsPageFilters,
    page,
    itemId: shared.itemId ?? undefined,
    chestFilter: shared.chestFilter,
    kind: shared.kind ?? undefined,
    from: shared.from || undefined,
    to: shared.to || undefined,
  };
}

export default function StockMovementsPageClient({
  initialPage,
}: StockMovementsPageClientProps) {
  const { permissions } = usePermissions();
  const canEdit = permissions?.stock.update ?? false;

  const defaultFrom = getMondayOfCurrentWeek();
  const defaultTo = getTodayStart();

  const [sharedFilters, setSharedFilters] = useState<StockMovementsSharedFilters>({
    itemId: null,
    chestFilter: 'all',
    kind: null,
    from: defaultFrom.toISOString(),
    to: defaultTo.toISOString(),
  });
  const [page, setPage] = useState(1);

  const [editModalOpened, setEditModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovementListItem | null>(null);

  const pageFilters = useMemo(
    () => buildPageFilters(sharedFilters, page),
    [sharedFilters, page],
  );

  const movementsQuery = useStockMovementsPage(pageFilters, { initialData: initialPage });
  const reconciliationQuery = useStockMovementReconciliation(
    sharedFilters,
    Boolean(sharedFilters.itemId && sharedFilters.from && sharedFilters.to),
  );
  const chestsQuery = useChestsListForMovements();
  const itemsQuery = useItemsListForMovements();

  const chestSelectOptions = useMemo(
    () => [
      { value: 'all', label: 'Tous les coffres' },
      { value: 'global', label: 'Sans coffre (global)' },
      ...(chestsQuery.data ?? []).map((chest) => ({
        value: chest.id,
        label: chest.name,
      })),
    ],
    [chestsQuery.data],
  );

  const itemOptions = useMemo(
    () =>
      (itemsQuery.data ?? []).map((item) => ({
        value: item.id,
        label: `${item.name} (${item.category.name})`,
      })),
    [itemsQuery.data],
  );

  const handleSharedFiltersChange = (patch: Partial<StockMovementsSharedFilters>) => {
    setSharedFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  return (
    <Container size="xl" py="xl">
      <Title order={1} mb="md" className="disp-display-title">
        Historique des mouvements
      </Title>
      <Text c="dimmed" mb="xl">
        Journal détaillé des variations de stock. Les corrections n&apos;affectent que l&apos;audit,
        pas le stock en cours.
      </Text>

      <Stack gap="lg">
        <StockMovementsFilters
          itemOptions={itemOptions}
          chestOptions={chestSelectOptions}
          filters={sharedFilters}
          onChange={handleSharedFiltersChange}
        />

        <ReconciliationPanel
          data={reconciliationQuery.data}
          loading={reconciliationQuery.isFetching}
          itemSelected={Boolean(sharedFilters.itemId)}
        />

        <StockMovementsTable
          movements={movementsQuery.data?.items ?? []}
          loading={movementsQuery.isFetching}
          page={page}
          pageSize={pageFilters.pageSize}
          totalRecords={movementsQuery.data?.totalCount ?? 0}
          canEdit={canEdit}
          onPageChange={setPage}
          onEdit={(movement) => {
            setSelectedMovement(movement);
            setEditModalOpened(true);
          }}
          onDelete={(movement) => {
            setSelectedMovement(movement);
            setDeleteModalOpened(true);
          }}
        />
      </Stack>

      <EditMovementModal
        opened={editModalOpened}
        onClose={() => {
          setEditModalOpened(false);
          setSelectedMovement(null);
        }}
        movement={selectedMovement}
      />

      <DeleteMovementModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setSelectedMovement(null);
        }}
        movement={selectedMovement}
      />
    </Container>
  );
}
