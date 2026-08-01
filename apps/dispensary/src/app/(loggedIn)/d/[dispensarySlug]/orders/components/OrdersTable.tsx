'use client';

import { useState } from 'react';
import {
  Paper,
  TextInput,
  Select,
  MultiSelect,
  Group,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import type { CSSProperties, ReactNode } from 'react';
import { OrderStatusBadge } from '@/app/_components/OrderBadges/OrderStatusBadge';
import { OrderTypeBadge } from '@/app/_components/OrderBadges/OrderTypeBadge';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconTrash, IconEye, IconMail } from '@tabler/icons-react';
import {
  orderStatusSelectOptions,
  orderTypeFilterOptions,
} from '@/lib/orders/orderSelectOptions';
import { parsePickerDate } from '@/lib/date';
import { getOrderClientDisplayName, type OrderSummary } from '@/types/orders';
import { OrderStatusEnum } from '@/types/enum/orderStatus';

interface OrdersTableProps {
  orders: OrderSummary[];
  loading: boolean;
  statusFilter: string[];
  typeFilter: string | null;
  nameFilter: string;
  createdAtFrom: string | null;
  createdAtTo: string | null;
  page: number;
  pageSize: number;
  totalRecords: number;
  permissions: any;
  onStatusFilterChange: (value: string[]) => void;
  onTypeFilterChange: (value: string | null) => void;
  onNameFilterChange: (value: string) => void;
  onCreatedAtRangeChange: (from: string | null, to: string | null) => void;
  onPageChange: (page: number) => void;
  onView: (order: OrderSummary) => void;
  onEdit: (order: OrderSummary) => void;
  onDelete: (order: OrderSummary) => void;
  onPreviewLetter?: (order: OrderSummary) => void;
  hasLetterTemplateForOrder?: (order: OrderSummary) => boolean;
}

const disabledActionStyle: CSSProperties = {
  opacity: 0.38,
  cursor: 'not-allowed',
};

function LockedActionIcon({
  label,
  activeLabel,
  locked,
  activeColor,
  onClick,
  children,
}: {
  label: string;
  activeLabel: string;
  locked: boolean;
  activeColor: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const icon = (
    <ActionIcon
      variant={locked ? 'subtle' : 'light'}
      color={locked ? 'slate' : activeColor}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      style={locked ? disabledActionStyle : undefined}
      aria-label={locked ? label : activeLabel}
    >
      {children}
    </ActionIcon>
  );

  if (!locked) {
    return (
      <Tooltip label={activeLabel} withArrow>
        {icon}
      </Tooltip>
    );
  }

  return (
    <Tooltip label={label} withArrow>
      <span style={{ display: 'inline-flex' }}>{icon}</span>
    </Tooltip>
  );
}

function StatusMultiSelectFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [dropdownOpened, setDropdownOpened] = useState(false);

  return (
    <MultiSelect
      placeholder="Tous les statuts"
      data={orderStatusSelectOptions}
      value={value}
      onChange={(next) => {
        onChange(next);
        requestAnimationFrame(() => setDropdownOpened(true));
      }}
      clearable
      searchable
      hidePickedOptions
      dropdownOpened={dropdownOpened}
      onDropdownClose={() => setDropdownOpened(false)}
      onClick={() => setDropdownOpened(true)}
      comboboxProps={{ withinPortal: false }}
      style={{ minWidth: 240 }}
    />
  );
}

function CreatedAtRangeFilter({
  value,
  onChange,
}: {
  value: [Date | null, Date | null];
  onChange: (from: string | null, to: string | null) => void;
}) {
  return (
    <DatesProvider settings={{ locale: 'fr', firstDayOfWeek: 1 }}>
      <DatePickerInput
        type="range"
        placeholder="Période"
        value={value}
        onChange={(next) => {
          const [rawFrom, rawTo] = (next ?? [null, null]) as [
            Date | string | null,
            Date | string | null,
          ];
          const from = parsePickerDate(rawFrom);
          const to = parsePickerDate(rawTo);
          onChange(from?.toISOString() ?? null, to?.toISOString() ?? null);
        }}
        valueFormat="D MMM YYYY"
        clearable
        closeOnChange={false}
        popoverProps={{ withinPortal: false, trapFocus: false }}
        style={{ minWidth: 240 }}
      />
    </DatesProvider>
  );
}

export function OrdersTable({
  orders,
  loading,
  statusFilter,
  typeFilter,
  nameFilter,
  createdAtFrom,
  createdAtTo,
  page,
  pageSize,
  totalRecords,
  permissions,
  onStatusFilterChange,
  onTypeFilterChange,
  onNameFilterChange,
  onCreatedAtRangeChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onPreviewLetter,
  hasLetterTemplateForOrder,
}: OrdersTableProps) {
  const dateRange: [Date | null, Date | null] = [
    createdAtFrom ? new Date(createdAtFrom) : null,
    createdAtTo ? new Date(createdAtTo) : null,
  ];

  return (
    <Paper shadow="sm" withBorder>
      <DataTable
        records={orders}
        fetching={loading}
        columns={[
          {
            accessor: 'status',
            title: 'Statut',
            render: (order: OrderSummary) => (
              <OrderStatusBadge status={order.status} />
            ),
            filtering: statusFilter.length > 0,
            filterPopoverProps: { trapFocus: false },
            filter: (
              <StatusMultiSelectFilter
                value={statusFilter}
                onChange={onStatusFilterChange}
              />
            ),
          },
          {
            accessor: 'type',
            title: 'Type',
            render: (order: OrderSummary) => (
              <OrderTypeBadge type={order.type || 'INCOMING'} />
            ),
            filtering: Boolean(typeFilter),
            filter: (
              <Select
                placeholder="Tous les types"
                data={orderTypeFilterOptions}
                value={typeFilter || ''}
                onChange={(value) => onTypeFilterChange(value || null)}
                clearable
                style={{ minWidth: 160 }}
              />
            ),
          },
          {
            accessor: 'name',
            title: 'Nom',
            sortable: true,
            filtering: Boolean(nameFilter.trim()),
            filter: (
              <TextInput
                placeholder="Rechercher un nom..."
                value={nameFilter}
                onChange={(e) => onNameFilterChange(e.currentTarget.value)}
                style={{ minWidth: 180 }}
              />
            ),
          },
          {
            accessor: 'client',
            title: 'Client',
            render: (order: OrderSummary) => getOrderClientDisplayName(order),
            sortable: false,
          },
          {
            accessor: 'price',
            title: 'Prix',
            render: (order: OrderSummary) =>
              order.price != null ? `${order.price.toFixed(2)} $` : '-',
            sortable: true,
          },
          {
            accessor: 'createdAt',
            title: 'Date de création',
            render: (order: OrderSummary) =>
              new Date(order.createdAt).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              }),
            sortable: true,
            filtering: Boolean(createdAtFrom || createdAtTo),
            filterPopoverProps: { trapFocus: false },
            filter: (
              <CreatedAtRangeFilter
                value={dateRange}
                onChange={onCreatedAtRangeChange}
              />
            ),
          },
          {
            accessor: 'actions',
            title: 'Actions',
            textAlign: 'right',
            render: (order: OrderSummary) => {
              const isCompleted = order.status === OrderStatusEnum.COMPLETED;

              return (
                <Group gap="xs" justify="flex-end" wrap="nowrap">
                  {hasLetterTemplateForOrder?.(order) && onPreviewLetter && (
                    <Tooltip label="Aperçu du courrier" withArrow>
                      <ActionIcon
                        variant="light"
                        color="denim"
                        onClick={() => onPreviewLetter(order)}
                        aria-label="Aperçu du courrier"
                      >
                        <IconMail size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="Voir les détails" withArrow>
                    <ActionIcon
                      variant="light"
                      color="slate"
                      onClick={() => onView(order)}
                      aria-label="Voir les détails"
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Tooltip>
                  {permissions?.orders.update && (
                    <LockedActionIcon
                      locked={isCompleted}
                      label="Commande terminée — modification impossible"
                      activeLabel="Modifier"
                      activeColor="slate"
                      onClick={() => onEdit(order)}
                    >
                      <IconEdit size={16} />
                    </LockedActionIcon>
                  )}
                  {permissions?.orders.delete && (
                    <LockedActionIcon
                      locked={isCompleted}
                      label="Commande terminée — suppression impossible"
                      activeLabel="Supprimer"
                      activeColor="danger"
                      onClick={() => onDelete(order)}
                    >
                      <IconTrash size={16} />
                    </LockedActionIcon>
                  )}
                </Group>
              );
            },
          },
        ]}
        totalRecords={totalRecords}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={onPageChange}
        minHeight={200}
        noRecordsText="Aucune commande trouvée"
      />
    </Paper>
  );
}
