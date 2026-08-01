'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { ActiveFilters } from '@/app/_components/ActiveFilters/ActiveFilters';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import type { OrderSummary, OrdersPageResult } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import { getOrderTypeLabel } from '@/types/enum/orderType';
import type { OrderType } from '@prisma/client';
import {
  defaultActiveOrdersPageFilters,
  useOrderLetterAssignments,
  useOrdersPage,
} from '../orders/hooks/useOrdersQueries';
import type { OrdersPageFilters } from '@/lib/orders/queryKeys';
import { OrdersTable } from '../orders/components/OrdersTable';
import { EditOrderModal } from '../orders/components/EditOrderModal';
import { DeleteOrderModal } from '../orders/components/DeleteOrderModal';
import { OrderDetailsModal } from '../orders/components/OrderDetailsModal';
import { OrderLetterPreviewModal } from '../orders/components/OrderLetterPreviewModal';

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

function isBaseActiveFilters(filters: OrdersPageFilters): boolean {
  return (
    filters.type === null &&
    filters.search === '' &&
    filters.createdAtFrom === null &&
    filters.createdAtTo === null
  );
}

type EmployeeActiveOrdersDashboardProps = {
  initialOrdersPage: OrdersPageResult;
  initialAssignments: OrderMailTemplateAssignment[];
  onActiveCountChange?: (count: number) => void;
};

export function EmployeeActiveOrdersDashboard({
  initialOrdersPage,
  initialAssignments,
  onActiveCountChange,
}: EmployeeActiveOrdersDashboardProps) {
  const { permissions } = usePermissions();
  const [filters, setFilters] = useState<Omit<OrdersPageFilters, 'search'>>({
    page: defaultActiveOrdersPageFilters.page,
    pageSize: defaultActiveOrdersPageFilters.pageSize,
    status: defaultActiveOrdersPageFilters.status,
    type: defaultActiveOrdersPageFilters.type,
    createdAtFrom: defaultActiveOrdersPageFilters.createdAtFrom,
    createdAtTo: defaultActiveOrdersPageFilters.createdAtTo,
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
  const [letterPreviewModalOpened, setLetterPreviewModalOpened] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<OrderSummary | null>(null);
  const [orderForLetterPreviewId, setOrderForLetterPreviewId] = useState<string | null>(
    null,
  );

  const { data: ordersPage, isFetching } = useOrdersPage(
    queryFilters,
    initialOrdersPage,
    defaultActiveOrdersPageFilters,
  );
  const { data: assignments = initialAssignments } = useOrderLetterAssignments(
    initialAssignments,
  );

  const orders = ordersPage?.orders ?? [];
  const totalRecords = ordersPage?.totalCount ?? 0;
  const isSearchDebouncing = searchInput !== debouncedSearch;
  const tableLoading = isFetching && !isSearchDebouncing;

  useEffect(() => {
    if (!onActiveCountChange) return;
    if (!isBaseActiveFilters(queryFilters)) return;
    onActiveCountChange(totalRecords);
  }, [totalRecords, queryFilters, onActiveCountChange]);

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
  }, [filters.type, filters.createdAtFrom, filters.createdAtTo, debouncedSearch]);

  return (
    <>
      <ActiveFilters
        filters={[
          {
            label: 'Nom',
            value: searchInput,
            onRemove: () => setSearchInput(''),
          },
          {
            label: 'Type',
            value: filters.type,
            displayValue: filters.type
              ? getOrderTypeLabel(filters.type as OrderType)
              : undefined,
            onRemove: () => setFilters((current) => ({ ...current, type: null })),
          },
          {
            label: 'Date de création',
            value:
              filters.createdAtFrom || filters.createdAtTo
                ? formatDateRangeChip(filters.createdAtFrom, filters.createdAtTo)
                : null,
            onRemove: () =>
              setFilters((current) => ({
                ...current,
                createdAtFrom: null,
                createdAtTo: null,
              })),
          },
        ]}
      />

      <OrdersTable
        orders={orders}
        loading={tableLoading}
        statusFilter={filters.status}
        typeFilter={filters.type}
        nameFilter={searchInput}
        createdAtFrom={filters.createdAtFrom}
        createdAtTo={filters.createdAtTo}
        page={filters.page}
        pageSize={filters.pageSize}
        totalRecords={totalRecords}
        permissions={permissions}
        hideStatusFilter
        onStatusFilterChange={() => undefined}
        onTypeFilterChange={(value) =>
          setFilters((current) => ({ ...current, type: value }))
        }
        onNameFilterChange={setSearchInput}
        onCreatedAtRangeChange={(from, to) =>
          setFilters((current) => ({
            ...current,
            createdAtFrom: from,
            createdAtTo: to,
          }))
        }
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
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
    </>
  );
}
