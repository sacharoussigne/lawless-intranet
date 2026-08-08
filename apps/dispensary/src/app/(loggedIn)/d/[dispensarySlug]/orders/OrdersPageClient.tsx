'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Container,
  Button,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconPackage } from '@tabler/icons-react';
import { EditOrderModal } from './components/EditOrderModal';
import { DeleteOrderModal } from './components/DeleteOrderModal';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { OrderLetterPreviewModal } from './components/OrderLetterPreviewModal';
import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { OrdersTable } from './components/OrdersTable';
import CreateOrderModal from './components/CreateOrderModal';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import {
  usePermissions,
  useRequiredDispensarySlug,
} from '@/app/_contexts/PermissionsContext';
import type { OrderSummary, OrdersPageResult } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import {
  defaultOrdersPageFilters,
  useOrderLetterAssignments,
  useOrdersPage,
} from './hooks/useOrdersQueries';
import type { OrdersPageFilters } from '@/lib/orders/queryKeys';
import {
  readOrdersFiltersPreference,
  writeOrdersFiltersPreference,
} from './ordersFiltersStorage';
import { getOrderStatusLabel } from '@/types/enum/orderStatus';
import { getOrderTypeLabel } from '@/types/enum/orderType';
import type { OrderStatus, OrderType } from '@lawless-intranet/inventory-client';

interface OrdersPageClientProps {
  initialOrdersPage: OrdersPageResult;
  initialAssignments: OrderMailTemplateAssignment[];
}

function formatDateRangeChip(from: string | null, to: string | null): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  if (from && to) return `${format(from)} → ${format(to)}`;
  if (from) return `Depuis ${format(from)}`;
  if (to) return `Jusqu'au ${format(to)}`;
  return '';
}

export default function OrdersPageClient({
  initialOrdersPage,
  initialAssignments,
}: OrdersPageClientProps) {
  const { permissions } = usePermissions();
  const dispensarySlug = useRequiredDispensarySlug();
  const [filtersReady, setFiltersReady] = useState(false);
  const [filters, setFilters] = useState<Omit<OrdersPageFilters, 'search'>>({
    page: defaultOrdersPageFilters.page,
    pageSize: defaultOrdersPageFilters.pageSize,
    status: defaultOrdersPageFilters.status,
    type: defaultOrdersPageFilters.type,
    createdAtFrom: defaultOrdersPageFilters.createdAtFrom,
    createdAtTo: defaultOrdersPageFilters.createdAtTo,
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  const queryFilters = useMemo<OrdersPageFilters>(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const [modalOpened, setModalOpened] = useState(false);
  const [detailsModalOpened, setDetailsModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [letterPreviewModalOpened, setLetterPreviewModalOpened] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<OrderSummary | null>(null);
  const [orderForLetterPreviewId, setOrderForLetterPreviewId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const saved = readOrdersFiltersPreference(dispensarySlug);
    if (saved) {
      setFilters((current) => ({
        ...current,
        page: 1,
        pageSize: saved.pageSize,
        status: saved.status,
        type: saved.type,
        createdAtFrom: saved.createdAtFrom,
        createdAtTo: saved.createdAtTo,
      }));
      setSearchInput(saved.search);
    }
    setFiltersReady(true);
  }, [dispensarySlug]);

  useEffect(() => {
    if (!filtersReady) return;
    writeOrdersFiltersPreference(dispensarySlug, {
      status: filters.status,
      type: filters.type,
      search: searchInput,
      pageSize: filters.pageSize,
      createdAtFrom: filters.createdAtFrom,
      createdAtTo: filters.createdAtTo,
    });
  }, [
    dispensarySlug,
    filtersReady,
    filters.status,
    filters.type,
    filters.pageSize,
    filters.createdAtFrom,
    filters.createdAtTo,
    searchInput,
  ]);

  const { data: ordersPage, isFetching } = useOrdersPage(
    queryFilters,
    filtersReady ? initialOrdersPage : undefined,
  );
  const { data: assignments = initialAssignments } = useOrderLetterAssignments(
    initialAssignments,
  );

  const orders = ordersPage?.orders ?? [];
  const totalRecords = ordersPage?.totalCount ?? 0;
  const hasActiveFilters = Boolean(
    filters.status.length > 0 ||
      filters.type ||
      filters.createdAtFrom ||
      filters.createdAtTo ||
      searchInput.trim(),
  );
  const isSearchDebouncing = searchInput !== debouncedSearch;
  const showEmptyCatalog = totalRecords === 0 && !isFetching && !hasActiveFilters;
  const tableLoading = isFetching && !isSearchDebouncing;

  const assignmentKeys = useMemo(() => {
    const keys = new Set<string>();
    assignments.forEach((assignment) => {
      keys.add(`${assignment.orderType}-${assignment.orderStatus}`);
    });
    return keys;
  }, [assignments]);

  const hasLetterTemplateForOrder = useCallback(
    (order: OrderSummary) => {
      const key = `${order.type || 'INCOMING'}-${order.status}`;
      return assignmentKeys.has(key);
    },
    [assignmentKeys],
  );

  useEffect(() => {
    setFilters((current) => ({ ...current, page: 1 }));
  }, [filters.status, filters.type, filters.createdAtFrom, filters.createdAtTo, debouncedSearch]);

  const handleStatusFilterChange = (value: string[]) => {
    setFilters((current) => ({ ...current, status: value }));
  };

  const handleTypeFilterChange = (value: string | null) => {
    setFilters((current) => ({ ...current, type: value }));
  };

  const handleNameFilterChange = (value: string) => {
    setSearchInput(value);
  };

  const handleCreatedAtRangeChange = (from: string | null, to: string | null) => {
    setFilters((current) => ({
      ...current,
      createdAtFrom: from,
      createdAtTo: to,
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters((current) => ({ ...current, page }));
  };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Commandes"
        actions={
          permissions?.orders.create ? (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
            >
              Créer une commande
            </Button>
          ) : undefined
        }
      />

      {showEmptyCatalog ? (
        <Paper shadow="sm" withBorder>
          <Stack align="center" gap="xs" py="xl">
            <IconPackage size={48} stroke={1.5} style={{ color: 'var(--mantine-color-dimmed)' }} />
            <Text size="sm" c="dimmed" fw={500}>
              Aucune commande trouvée
            </Text>
          </Stack>
        </Paper>
      ) : (
        <>
          <ActiveFilters
            filters={[
              {
                label: 'Nom',
                value: searchInput,
                onRemove: () => setSearchInput(''),
              },
              {
                label: 'Statut',
                value:
                  filters.status.length > 0
                    ? filters.status
                        .map((status) => getOrderStatusLabel(status as OrderStatus))
                        .join(', ')
                    : null,
                onRemove: () => handleStatusFilterChange([]),
              },
              {
                label: 'Type',
                value: filters.type,
                displayValue: filters.type
                  ? getOrderTypeLabel(filters.type as OrderType)
                  : undefined,
                onRemove: () => handleTypeFilterChange(null),
              },
              {
                label: 'Date de création',
                value:
                  filters.createdAtFrom || filters.createdAtTo
                    ? formatDateRangeChip(filters.createdAtFrom, filters.createdAtTo)
                    : null,
                onRemove: () => handleCreatedAtRangeChange(null, null),
              },
            ]}
          />

          <OrdersTable
            orders={orders}
            loading={tableLoading || !filtersReady}
            statusFilter={filters.status}
            typeFilter={filters.type}
            nameFilter={searchInput}
            createdAtFrom={filters.createdAtFrom}
            createdAtTo={filters.createdAtTo}
            page={filters.page}
            pageSize={filters.pageSize}
            totalRecords={totalRecords}
            permissions={permissions}
            onStatusFilterChange={handleStatusFilterChange}
            onTypeFilterChange={handleTypeFilterChange}
            onNameFilterChange={handleNameFilterChange}
            onCreatedAtRangeChange={handleCreatedAtRangeChange}
            onPageChange={handlePageChange}
            onView={(order) => {
              setViewingOrderId(order.id);
              setDetailsModalOpened(true);
            }}
            onEdit={(order) => {
              setEditingOrderId(order.id);
              setModalOpened(true);
            }}
            onDelete={(order) => {
              setOrderToDelete(order);
              setDeleteModalOpened(true);
            }}
            onPreviewLetter={(order) => {
              setOrderForLetterPreviewId(order.id);
              setLetterPreviewModalOpened(true);
            }}
            hasLetterTemplateForOrder={hasLetterTemplateForOrder}
          />
        </>
      )}

      <EditOrderModal
        opened={modalOpened}
        onClose={() => {
          setModalOpened(false);
          setEditingOrderId(null);
        }}
        orderId={editingOrderId}
      />

      <OrderDetailsModal
        opened={detailsModalOpened}
        onClose={() => {
          setDetailsModalOpened(false);
          setViewingOrderId(null);
        }}
        orderId={viewingOrderId}
      />

      <DeleteOrderModal
        opened={deleteModalOpened}
        onClose={() => {
          setDeleteModalOpened(false);
          setOrderToDelete(null);
        }}
        orderToDelete={orderToDelete}
      />

      <OrderLetterPreviewModal
        opened={letterPreviewModalOpened}
        onClose={() => {
          setLetterPreviewModalOpened(false);
          setOrderForLetterPreviewId(null);
        }}
        orderId={orderForLetterPreviewId}
      />

      <CreateOrderModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        prefillItemsNeedingRestock={false}
      />
    </Container>
  );
}
