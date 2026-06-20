'use client';

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ActionIcon, Badge, Button, Checkbox, Group, Paper, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import type { StockMovementListItem } from '@/types/stock';
import {
  getStockMovementKindLabel,
  getStockMovementQuantityColor,
} from '@/lib/stock/movements';
import type { StockMovementKind } from '@prisma/client';
import type { DataTableColumn } from 'mantine-datatable';

interface StockMovementsTableProps {
  movements: StockMovementListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalRecords: number;
  canEdit: boolean;
  clearSelectionSignal?: number;
  onPageChange: (page: number) => void;
  onEdit: (movement: StockMovementListItem) => void;
  onDelete: (movement: StockMovementListItem) => void;
  onBulkDelete: (movements: StockMovementListItem[]) => void;
}

type SelectionContextValue = {
  selectedIds: Set<string>;
  toggleMovement: (movementId: string) => void;
  toggleAllOnPage: () => void;
  allPageSelected: boolean;
  somePageSelected: boolean;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function formatChestLabel(movement: StockMovementListItem): string {
  if (!movement.chestName) return 'Non renseigné';
  if (movement.destinationChestName) {
    return `${movement.chestName} → ${movement.destinationChestName}`;
  }
  return movement.chestName;
}

const MovementSelectCheckbox = memo(function MovementSelectCheckbox({
  checked,
  indeterminate,
  label,
  onToggle,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Checkbox
      checked={checked}
      indeterminate={indeterminate}
      onChange={onToggle}
      aria-label={label}
    />
  );
});

const MovementSelectionCell = memo(function MovementSelectionCell({
  movementId,
  label,
}: {
  movementId: string;
  label: string;
}) {
  const selection = useContext(SelectionContext);
  if (!selection) return null;

  return (
    <MovementSelectCheckbox
      checked={selection.selectedIds.has(movementId)}
      label={label}
      onToggle={() => selection.toggleMovement(movementId)}
    />
  );
});

const PageSelectionHeader = memo(function PageSelectionHeader() {
  const selection = useContext(SelectionContext);
  if (!selection) return null;

  return (
    <MovementSelectCheckbox
      checked={selection.allPageSelected}
      indeterminate={selection.somePageSelected && !selection.allPageSelected}
      label="Sélectionner toute la page"
      onToggle={selection.toggleAllOnPage}
    />
  );
});

function buildColumns(
  canEdit: boolean,
  onEdit: (movement: StockMovementListItem) => void,
  onDelete: (movement: StockMovementListItem) => void,
): DataTableColumn<StockMovementListItem>[] {
  const columns: DataTableColumn<StockMovementListItem>[] = [];

  if (canEdit) {
    columns.push({
      accessor: '__select',
      title: <PageSelectionHeader />,
      width: 44,
      textAlign: 'center',
      render: (movement) => (
        <MovementSelectionCell
          movementId={movement.id}
          label={`Sélectionner ${movement.itemName}`}
        />
      ),
    });
  }

  columns.push(
    {
      accessor: 'createdAt',
      title: 'Date',
      width: 160,
      render: (movement) =>
        new Date(movement.createdAt).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      accessor: 'itemName',
      title: 'Item',
      render: (movement) => (
        <div>
          <Text size="sm" fw={500}>
            {movement.itemName}
          </Text>
          <Text size="xs" c="dimmed">
            {movement.categoryName}
          </Text>
        </div>
      ),
    },
    {
      accessor: 'chestName',
      title: 'Coffre',
      render: (movement) => formatChestLabel(movement),
    },
    {
      accessor: 'quantity',
      title: 'Delta',
      width: 90,
      textAlign: 'right',
      render: (movement) => (
        <Text size="sm" fw={600} c={getStockMovementQuantityColor(movement.quantity)}>
          {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
        </Text>
      ),
    },
    {
      accessor: 'kind',
      title: 'Type',
      render: (movement) => (
        <Badge variant="outline" color="slate" radius="sm">
          {getStockMovementKindLabel(movement.kind as StockMovementKind)}
        </Badge>
      ),
    },
    {
      accessor: 'userName',
      title: 'Auteur',
      render: (movement) => movement.userName ?? '—',
    },
    {
      accessor: 'note',
      title: 'Note',
      render: (movement) => movement.note ?? '—',
    },
    {
      accessor: 'actions',
      title: 'Actions',
      width: 100,
      render: (movement) => (
        <Group gap="xs" wrap="nowrap" justify="flex-end">
          <ActionIcon
            variant="light"
            color="slate"
            onClick={() => onEdit(movement)}
            title="Modifier"
            disabled={!canEdit}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="light"
            color="danger"
            onClick={() => onDelete(movement)}
            title="Supprimer"
            disabled={!canEdit}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  );

  return columns;
}

export function StockMovementsTable({
  movements,
  loading,
  page,
  pageSize,
  totalRecords,
  canEdit,
  clearSelectionSignal = 0,
  onPageChange,
  onEdit,
  onDelete,
  onBulkDelete,
}: StockMovementsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const movementsById = useMemo(
    () => new Map(movements.map((movement) => [movement.id, movement])),
    [movements],
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, clearSelectionSignal]);

  const allPageSelected =
    movements.length > 0 && movements.every((movement) => selectedIds.has(movement.id));
  const somePageSelected = movements.some((movement) => selectedIds.has(movement.id));

  const toggleMovement = useCallback((movementId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(movementId)) {
        next.delete(movementId);
      } else {
        next.add(movementId);
      }
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) {
        for (const movement of movements) {
          next.delete(movement.id);
        }
        return next;
      }

      for (const movement of movements) {
        next.add(movement.id);
      }
      return next;
    });
  }, [allPageSelected, movements]);

  const selectionContextValue = useMemo<SelectionContextValue>(
    () => ({
      selectedIds,
      toggleMovement,
      toggleAllOnPage,
      allPageSelected,
      somePageSelected,
    }),
    [allPageSelected, selectedIds, somePageSelected, toggleAllOnPage, toggleMovement],
  );

  const columns = useMemo(
    () => buildColumns(canEdit, onEdit, onDelete),
    [canEdit, onDelete, onEdit],
  );

  const handleBulkDelete = useCallback(() => {
    const selectedMovements = [...selectedIds]
      .map((id) => movementsById.get(id))
      .filter((movement): movement is StockMovementListItem => movement !== undefined);
    onBulkDelete(selectedMovements);
  }, [movementsById, onBulkDelete, selectedIds]);

  const selectedCount = selectedIds.size;

  return (
    <SelectionContext.Provider value={selectionContextValue}>
      <Paper shadow="sm" p="md" withBorder>
        {canEdit && selectedCount > 0 && (
          <Group justify="space-between" mb="md">
            <Text size="sm" c="dimmed">
              {selectedCount} mouvement{selectedCount > 1 ? 's' : ''} sélectionné
              {selectedCount > 1 ? 's' : ''}
            </Text>
            <Button
              color="danger"
              variant="light"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={handleBulkDelete}
            >
              Supprimer la sélection
            </Button>
          </Group>
        )}

        <DataTable
          records={movements}
          columns={columns}
          fetching={loading}
          noRecordsText="Aucun mouvement trouvé pour ces filtres"
          striped
          highlightOnHover
          minHeight={200}
          totalRecords={totalRecords}
          recordsPerPage={pageSize}
          page={page}
          onPageChange={onPageChange}
          paginationSize="sm"
          paginationText={({ from, to, totalRecords: total }) =>
            `${from} - ${to} sur ${total} mouvements`
          }
        />
      </Paper>
    </SelectionContext.Provider>
  );
}
