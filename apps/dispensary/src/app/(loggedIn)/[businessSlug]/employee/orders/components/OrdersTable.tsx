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
  Box,
  Button,
  Center,
  Drawer,
  Indicator,
  Loader,
  Pagination,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import type { CSSProperties, ReactNode } from 'react';
import { OrderStatusBadge } from '@/app/_components/OrderBadges/OrderStatusBadge';
import { OrderTypeBadge } from '@/app/_components/OrderBadges/OrderTypeBadge';
import { DataTable } from 'mantine-datatable';
import { IconEdit, IconTrash, IconEye, IconFilter, IconMail, IconSearch } from '@tabler/icons-react';
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
  hideStatusFilter?: boolean;
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

/** Phones: one card per order, labelled action buttons, filters in a bottom drawer. */
function OrdersMobileList({
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
  hideStatusFilter = false,
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
  const [filtersOpened, setFiltersOpened] = useState(false);
  const activeFilters =
    (typeFilter ? 1 : 0) +
    (createdAtFrom || createdAtTo ? 1 : 0) +
    (!hideStatusFilter && statusFilter.length > 0 ? 1 : 0);
  const pageCount = Math.max(1, Math.ceil(totalRecords / pageSize));

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="nowrap">
        <TextInput
          placeholder="Rechercher un nom..."
          value={nameFilter}
          onChange={(e) => onNameFilterChange(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1 }}
        />
        <Indicator label={activeFilters} size={16} disabled={activeFilters === 0}>
          <Button variant="light" leftSection={<IconFilter size={16} />} onClick={() => setFiltersOpened(true)}>
            Filtres
          </Button>
        </Indicator>
      </Group>

      {loading && orders.length === 0 ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : orders.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">
          Aucune commande trouvée
        </Text>
      ) : (
        orders.map((order) => {
          const isCompleted = order.status === OrderStatusEnum.COMPLETED;
          return (
            <Paper key={order.id} withBorder radius="md" p="sm" style={{ opacity: loading ? 0.6 : 1 }}>
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                  <Text fw={700} style={{ minWidth: 0 }} lineClamp={2}>
                    {order.name}
                  </Text>
                  <OrderStatusBadge status={order.status} />
                </Group>
                <Group gap="xs" wrap="wrap">
                  <OrderTypeBadge type={order.type || 'INCOMING'} />
                  <Text size="sm" c="dimmed">
                    {getOrderClientDisplayName(order)}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Text fw={600}>{order.price != null ? `${order.price.toFixed(2)} $` : '-'}</Text>
                </Group>
                <Group gap="xs" grow>
                  <Button size="xs" variant="light" color="slate" leftSection={<IconEye size={14} />} onClick={() => onView(order)}>
                    Détails
                  </Button>
                  {hasLetterTemplateForOrder?.(order) && onPreviewLetter && (
                    <Button size="xs" variant="light" color="denim" leftSection={<IconMail size={14} />} onClick={() => onPreviewLetter(order)}>
                      Courrier
                    </Button>
                  )}
                  {permissions?.orders.update && (
                    <Button
                      size="xs"
                      variant="light"
                      color="slate"
                      leftSection={<IconEdit size={14} />}
                      disabled={isCompleted}
                      onClick={() => onEdit(order)}
                    >
                      Modifier
                    </Button>
                  )}
                  {permissions?.orders.delete && (
                    <Button
                      size="xs"
                      variant="light"
                      color="danger"
                      leftSection={<IconTrash size={14} />}
                      disabled={isCompleted}
                      onClick={() => onDelete(order)}
                    >
                      Supprimer
                    </Button>
                  )}
                </Group>
              </Stack>
            </Paper>
          );
        })
      )}

      {pageCount > 1 && (
        <Center>
          <Pagination total={pageCount} value={page} onChange={onPageChange} size="sm" />
        </Center>
      )}

      <Drawer
        opened={filtersOpened}
        onClose={() => setFiltersOpened(false)}
        position="bottom"
        size="auto"
        title="Filtres"
        radius="md"
      >
        <Stack gap="md" pb="md">
          {!hideStatusFilter && <StatusMultiSelectFilter value={statusFilter} onChange={onStatusFilterChange} />}
          <Select
            label="Type"
            placeholder="Tous les types"
            data={orderTypeFilterOptions}
            value={typeFilter || ''}
            onChange={(value) => onTypeFilterChange(value || null)}
            clearable
            comboboxProps={{ withinPortal: false }}
          />
          <CreatedAtRangeFilter
            value={[createdAtFrom ? new Date(createdAtFrom) : null, createdAtTo ? new Date(createdAtTo) : null]}
            onChange={onCreatedAtRangeChange}
          />
          <Button onClick={() => setFiltersOpened(false)}>Voir les commandes</Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

export function OrdersTable(props: OrdersTableProps) {
  return (
    <>
      <Box visibleFrom="sm">
        <OrdersDataTable {...props} />
      </Box>
      <Box hiddenFrom="sm">
        <OrdersMobileList {...props} />
      </Box>
    </>
  );
}

function OrdersDataTable({
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
  hideStatusFilter = false,
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
            ...(hideStatusFilter
              ? {}
              : {
                  filtering: statusFilter.length > 0,
                  filterPopoverProps: { trapFocus: false },
                  filter: (
                    <StatusMultiSelectFilter
                      value={statusFilter}
                      onChange={onStatusFilterChange}
                    />
                  ),
                }),
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
