'use client';

import { Badge, Group, Paper, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { ActionIcon } from '@mantine/core';
import type { StockMovementListItem } from '@/types/stock';
import {
  getStockMovementKindLabel,
  getStockMovementQuantityColor,
} from '@/lib/stock/movements';
import type { StockMovementKind } from '@prisma/client';

interface StockMovementsTableProps {
  movements: StockMovementListItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  totalRecords: number;
  canEdit: boolean;
  onPageChange: (page: number) => void;
  onEdit: (movement: StockMovementListItem) => void;
  onDelete: (movement: StockMovementListItem) => void;
}

function formatChestLabel(movement: StockMovementListItem): string {
  if (!movement.chestName) return 'Non renseigné';
  if (movement.destinationChestName) {
    return `${movement.chestName} → ${movement.destinationChestName}`;
  }
  return movement.chestName;
}

export function StockMovementsTable({
  movements,
  loading,
  page,
  pageSize,
  totalRecords,
  canEdit,
  onPageChange,
  onEdit,
  onDelete,
}: StockMovementsTableProps) {
  return (
    <Paper shadow="sm" p="md" withBorder>
      <DataTable
        records={movements}
        columns={[
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
              <Text
                size="sm"
                fw={600}
                c={getStockMovementQuantityColor(movement.quantity)}
              >
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
        ]}
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
  );
}
