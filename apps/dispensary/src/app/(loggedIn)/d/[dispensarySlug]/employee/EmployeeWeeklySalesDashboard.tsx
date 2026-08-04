'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { DataTable, type DataTableColumn } from 'mantine-datatable';
import { IconCashRegister, IconSearch } from '@tabler/icons-react';
import {
  cancelSale,
  deleteSale,
  depositSaleInCashRegister,
  listWeeklySales,
  type SaleListItem,
  type WeeklySalesSummary,
} from '@/app/_actions/sales';
import { DataTableEmptyState } from '@/app/_components/DataTableEmptyState/DataTableEmptyState';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { handleAction } from '@/lib/action';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { formatDate, parsePickerDate } from '@/lib/date';
import dayjs from '@/lib/dayjs';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { SaleStatus } from '@prisma/client';
import { apothecaryBooleanPills, apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette } from '@/lib/design-tokens';
import { normalizeString } from '@/lib/string/normalizeString';
import { salesMutationMeta } from '@/lib/sales/realtime/client/mutationMeta';
import { useSalesRealtime } from '@/lib/sales/realtime/client/useSalesRealtime';

const DEFAULT_PAGE_SIZE = 10;
const STATUS_FILTER_STORAGE_KEY = 'employee-sales-status-filter';
const STATUS_FILTER_VALUES = [
  'completed',
  'cancelled',
  'deposited',
  'not_deposited',
] as const;

function readStatusFilterPreference(): string | null {
  try {
    const raw = window.localStorage.getItem(STATUS_FILTER_STORAGE_KEY);
    if (raw == null || raw === '') return null;
    return (STATUS_FILTER_VALUES as readonly string[]).includes(raw) ? raw : null;
  } catch {
    return null;
  }
}

type EmployeeWeeklySalesDashboardProps = {
  dispensarySlug: string;
  canCancel: boolean;
  canDepositOthers: boolean;
  canDelete: boolean;
  canViewAll: boolean;
  sessionUserId: string;
  initialSummary: WeeklySalesSummary;
  periodWeekDateValue: Date;
  pageSize?: number;
  detailVisible?: boolean;
  onDetailVisibleChange?: (visible: boolean) => void;
};

export function EmployeeWeeklySalesDashboard({
  dispensarySlug,
  canCancel,
  canDepositOthers,
  canDelete,
  canViewAll,
  sessionUserId,
  initialSummary,
  periodWeekDateValue,
  pageSize = DEFAULT_PAGE_SIZE,
  detailVisible = true,
  onDetailVisibleChange,
}: EmployeeWeeklySalesDashboardProps) {
  const queryClient = useQueryClient();
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<Date | null>(null);
  const [itemFilter, setItemFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [statusFilterReady, setStatusFilterReady] = useState(false);
  const [page, setPage] = useState(1);

  const handleRealtimeChange = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['weekly-sales', dispensarySlug] });
  }, [dispensarySlug, queryClient]);

  const { clientId } = useSalesRealtime({
    onChange: handleRealtimeChange,
  });
  const mutationMeta = salesMutationMeta(clientId);

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

  useEffect(() => {
    setStatusFilter(readStatusFilterPreference());
    setStatusFilterReady(true);
  }, []);

  useEffect(() => {
    if (!statusFilterReady) return;
    try {
      if (statusFilter == null) {
        window.localStorage.removeItem(STATUS_FILTER_STORAGE_KEY);
      } else {
        window.localStorage.setItem(STATUS_FILTER_STORAGE_KEY, statusFilter);
      }
    } catch {
      // Ignore quota / private mode write failures.
    }
  }, [statusFilter, statusFilterReady]);

  useEffect(() => {
    setEmployeeFilter(null);
    setDayFilter(null);
    setItemFilter('');
    setPage(1);
  }, [periodWeekDateValue]);

  const salesQuery = useQuery({
    queryKey: [
      'weekly-sales',
      dispensarySlug,
      currentWeekBounds.start.toISOString(),
      currentWeekBounds.end.toISOString(),
    ],
    queryFn: async () =>
      handleAction(
        await listWeeklySales(dispensarySlug, currentWeekBounds.start),
      ) as WeeklySalesSummary,
    initialData:
      currentWeekBounds.start.getTime() ===
      new Date(initialSummary.periodStart).getTime()
        ? initialSummary
        : undefined,
    staleTime: DEFAULT_STALE_TIME_MS,
  });

  const summary = salesQuery.data ?? initialSummary;

  const cancelMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const result = await cancelSale(dispensarySlug, saleId, mutationMeta);
      handleAction(result);
      return saleId;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Succès',
        message: 'Vente annulée',
        color: 'moss',
      });
      void queryClient.invalidateQueries({ queryKey: ['weekly-sales', dispensarySlug] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de l\'annulation',
        color: 'danger',
      });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const result = await depositSaleInCashRegister(dispensarySlug, saleId, mutationMeta);
      handleAction(result);
      return saleId;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Succès',
        message: 'Déposé en caisse',
        color: 'moss',
      });
      void queryClient.invalidateQueries({ queryKey: ['weekly-sales', dispensarySlug] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors du dépôt en caisse',
        color: 'danger',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const result = await deleteSale(dispensarySlug, saleId, mutationMeta);
      handleAction(result);
      return saleId;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Succès',
        message: 'Vente supprimée',
        color: 'moss',
      });
      void queryClient.invalidateQueries({ queryKey: ['weekly-sales', dispensarySlug] });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression',
        color: 'danger',
      });
    },
  });

  const employeeOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const sale of summary.sales) {
      names.set(sale.userId, sale.userName);
    }
    return Array.from(names.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
  }, [summary.sales]);

  const filteredSales = useMemo(() => {
    const dayKey = dayFilter
      ? dayjs(dayFilter).tz('Europe/Paris').format('YYYY-MM-DD')
      : null;
    const itemQuery = normalizeString(itemFilter.trim());

    return summary.sales.filter((sale) => {
      if (employeeFilter && sale.userId !== employeeFilter) return false;
      if (dayKey) {
        const saleDay = dayjs(sale.createdAt).tz('Europe/Paris').format('YYYY-MM-DD');
        if (saleDay !== dayKey) return false;
      }
      if (itemQuery) {
        const matchesItem = sale.items.some((item) =>
          normalizeString(item.itemName).includes(itemQuery),
        );
        if (!matchesItem) return false;
      }
      if (statusFilter === 'completed' && sale.status !== SaleStatus.COMPLETED) return false;
      if (statusFilter === 'cancelled' && sale.status !== SaleStatus.CANCELLED) return false;
      if (statusFilter === 'deposited') {
        if (sale.status !== SaleStatus.COMPLETED || !sale.depositedInCashRegister) return false;
      }
      if (statusFilter === 'not_deposited') {
        if (sale.status !== SaleStatus.COMPLETED || sale.depositedInCashRegister) return false;
      }
      return true;
    });
  }, [summary.sales, employeeFilter, dayFilter, itemFilter, statusFilter]);

  const totalRecords = filteredSales.length;
  const maxPage = Math.max(1, Math.ceil(totalRecords / pageSize) || 1);
  const safePage = Math.min(page, maxPage);
  const paginatedSales = useMemo(
    () => filteredSales.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredSales, safePage, pageSize],
  );
  const showSalesDetail = detailVisible;
  const showDetailToggle = typeof onDetailVisibleChange === 'function';

  const columns = useMemo((): DataTableColumn<SaleListItem>[] => {
    const cols: DataTableColumn<SaleListItem>[] = [
      {
        accessor: 'createdAt',
        title: 'Date',
        width: 130,
        render: (sale) => (
          <Stack gap={2}>
            <Text size="sm">
              {dayjs(sale.createdAt).tz('Europe/Paris').format('DD/MM HH:mm')}
            </Text>
            {sale.customerName && (
              <Text size="xs" c="dimmed">
                {sale.customerName}
              </Text>
            )}
          </Stack>
        ),
        filter: (
          <DatesProvider settings={{ locale: 'fr' }}>
            <DatePickerInput
              placeholder="Jour"
              value={dayFilter ? formatDate(dayFilter) : null}
              onChange={(value) => {
                setDayFilter(parsePickerDate(value as Date | string | null));
                setPage(1);
              }}
              clearable
              minDate={formatDate(currentWeekBounds.start)}
              maxDate={formatDate(currentWeekBounds.end)}
              style={{ minWidth: 160 }}
            />
          </DatesProvider>
        ),
      },
    ];

    if (canViewAll) {
      cols.push({
        accessor: 'userName',
        title: 'Employé',
        width: 160,
        filter: (
          <Select
            placeholder="Tous"
            data={employeeOptions}
            value={employeeFilter}
            onChange={(value) => {
              setEmployeeFilter(value);
              setPage(1);
            }}
            clearable
            searchable
            style={{ minWidth: 160 }}
          />
        ),
      });
    }

    cols.push(
      {
        accessor: 'items',
        title: 'Objets',
        render: (sale) => (
          <Stack gap={2}>
            {sale.items.map((item) => (
              <Text key={item.id} size="sm">
                {item.quantity}× {item.itemName}{' '}
                <Text span size="xs" c="dimmed">
                  ({item.source === 'POCKET' ? 'poche' : item.chestName ?? 'coffre'})
                </Text>
              </Text>
            ))}
          </Stack>
        ),
        filter: (
          <TextInput
            placeholder="Rechercher un objet…"
            leftSection={<IconSearch size={14} />}
            value={itemFilter}
            onChange={(event) => {
              setItemFilter(event.currentTarget.value);
              setPage(1);
            }}
            style={{ minWidth: 180 }}
          />
        ),
      },
      {
        accessor: 'totalAmount',
        title: 'Total',
        width: 110,
        render: (sale) => (
          <Stack gap={2}>
            <Text size="sm">{sale.totalAmount.toFixed(2)} $</Text>
            {sale.priceAdjustment !== 0 && (
              <Text size="xs" c="dimmed">
                dont {sale.priceAdjustment > 0 ? '+' : ''}
                {sale.priceAdjustment.toFixed(2)} $
              </Text>
            )}
          </Stack>
        ),
      },
      {
        accessor: 'status',
        title: 'Statut',
        width: 140,
        render: (sale) => (
          <Badge
            variant="outline"
            style={
              sale.status === SaleStatus.COMPLETED
                ? apothecaryBooleanPills.yes
                : apothecaryPillStyle(amberPalette)
            }
          >
            {sale.status === SaleStatus.COMPLETED ? 'Validée' : 'Annulée'}
          </Badge>
        ),
        filter: (
          <Select
            placeholder="Tous"
            data={[
              { value: 'completed', label: 'Validée' },
              { value: 'cancelled', label: 'Annulée' },
              { value: 'deposited', label: 'Déposé en caisse' },
              { value: 'not_deposited', label: 'Non déposé' },
            ]}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            clearable
            style={{ minWidth: 160 }}
          />
        ),
      },
      {
        accessor: 'actions',
        title: '',
        width: 220,
        render: (sale) => {
          const isCompleted = sale.status === SaleStatus.COMPLETED;
          const canDepositSale =
            isCompleted &&
            !sale.depositedInCashRegister &&
            (sale.userId === sessionUserId || canDepositOthers);
          const canCancelSale =
            canCancel &&
            isCompleted &&
            !sale.depositedInCashRegister &&
            (sale.userId === sessionUserId || canViewAll);

          if (
            !canDepositSale &&
            !canCancelSale &&
            !canDelete &&
            !(sale.depositedInCashRegister && isCompleted)
          ) {
            return null;
          }

          return (
            <Group gap="xs" wrap="nowrap">
              {sale.depositedInCashRegister && isCompleted && (
                <Badge variant="outline" style={apothecaryBooleanPills.yes}>
                  Déposé en caisse
                </Badge>
              )}
              {canDepositSale && (
                <DeleteConfirmPopover
                  title="Déposer en caisse ?"
                  message="Action irréversible : la vente ne pourra plus être annulée."
                  confirmLabel="Confirmer"
                  confirmColor="sage"
                  onConfirm={async () => {
                    await depositMutation.mutateAsync(sale.id);
                  }}
                >
                  <Button
                    size="xs"
                    variant="light"
                    color="sage"
                    loading={depositMutation.isPending && depositMutation.variables === sale.id}
                  >
                    Caisse
                  </Button>
                </DeleteConfirmPopover>
              )}
              {canCancelSale && (
                <DeleteConfirmPopover
                  title="Confirmer l'annulation ?"
                  message="Le stock coffre sera restauré. Cette action est irréversible."
                  confirmLabel="Confirmer"
                  onConfirm={async () => {
                    await cancelMutation.mutateAsync(sale.id);
                  }}
                >
                  <Button
                    size="xs"
                    variant="light"
                    color="danger"
                    loading={cancelMutation.isPending && cancelMutation.variables === sale.id}
                  >
                    Annuler
                  </Button>
                </DeleteConfirmPopover>
              )}
              {canDelete && (
                <DeleteConfirmPopover
                  title="Supprimer la vente ?"
                  message="La vente sera définitivement supprimée. Le stock coffre sera restauré si elle était encore validée."
                  onConfirm={async () => {
                    await deleteMutation.mutateAsync(sale.id);
                  }}
                >
                  <Button
                    size="xs"
                    variant="light"
                    color="danger"
                    loading={deleteMutation.isPending && deleteMutation.variables === sale.id}
                  >
                    Supprimer
                  </Button>
                </DeleteConfirmPopover>
              )}
            </Group>
          );
        },
      },
    );

    return cols;
  }, [
    canCancel,
    canDelete,
    canDepositOthers,
    canViewAll,
    cancelMutation.isPending,
    cancelMutation.variables,
    currentWeekBounds.end,
    currentWeekBounds.start,
    dayFilter,
    deleteMutation.isPending,
    deleteMutation.variables,
    depositMutation.isPending,
    depositMutation.variables,
    employeeFilter,
    employeeOptions,
    itemFilter,
    sessionUserId,
    statusFilter,
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text
          className="disp-display-title"
          style={{ cursor: showDetailToggle ? 'pointer' : undefined }}
          onClick={() => {
            if (!onDetailVisibleChange) return;
            onDetailVisibleChange(!showSalesDetail);
          }}
        >
          Ventes de la semaine
        </Text>
        {showDetailToggle && onDetailVisibleChange && (
          <Switch
            label="Afficher le détail des ventes"
            checked={showSalesDetail}
            onChange={(event) => onDetailVisibleChange(event.currentTarget.checked)}
            size="sm"
          />
        )}
      </Group>

      {showSalesDetail && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">
              CA (ventes validées)
            </Text>
            <Text fw={700} size="xl">
              {summary.totalAmount.toFixed(2)} $
            </Text>
          </Paper>
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">
              Quantité vendue
            </Text>
            <Text fw={700} size="xl">
              {summary.totalQuantity}
            </Text>
          </Paper>
          <Paper withBorder p="md">
            <Text size="xs" c="dimmed" tt="uppercase">
              Ventes / annulées
            </Text>
            <Text fw={700} size="xl">
              {summary.completedCount} / {summary.cancelledCount}
            </Text>
          </Paper>
        </SimpleGrid>
      )}

      {showSalesDetail && canViewAll && summary.byUser.length > 0 && (
        <Paper withBorder p="md">
          <Text size="sm" fw={600} mb="sm">
            Par employé
          </Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Employé</Table.Th>
                <Table.Th>Ventes</Table.Th>
                <Table.Th>Quantité</Table.Th>
                <Table.Th>CA</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.byUser.map((row) => (
                <Table.Tr key={row.userId}>
                  <Table.Td>{row.userName}</Table.Td>
                  <Table.Td>{row.completedCount}</Table.Td>
                  <Table.Td>{row.totalQuantity}</Table.Td>
                  <Table.Td>{row.totalAmount.toFixed(2)} $</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm" wrap="wrap">
          <Text size="sm" fw={600}>
            Ventes
          </Text>
          {(employeeFilter || dayFilter || itemFilter.trim() || statusFilter) && (
            <Button
              variant="subtle"
              color="slate"
              size="xs"
              onClick={() => {
                setEmployeeFilter(null);
                setDayFilter(null);
                setItemFilter('');
                setStatusFilter(null);
                setPage(1);
              }}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </Group>

        <DataTable
          idAccessor="id"
          records={paginatedSales}
          columns={columns}
          fetching={salesQuery.isFetching}
          minHeight={180}
          highlightOnHover
          withTableBorder={false}
          totalRecords={totalRecords}
          recordsPerPage={pageSize}
          page={safePage}
          onPageChange={setPage}
          paginationSize="sm"
          paginationText={({ from, to, totalRecords: total }) =>
            `${from} - ${to} sur ${total} ventes`
          }
          emptyState={
            <DataTableEmptyState
              icon={IconCashRegister}
              message={
                summary.sales.length === 0
                  ? 'Aucune vente sur cette semaine.'
                  : 'Aucune vente ne correspond aux filtres.'
              }
            />
          }
        />
      </Paper>
    </Stack>
  );
}
