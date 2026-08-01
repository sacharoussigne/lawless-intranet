'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
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

const PAGE_SIZE = 10;

type EmployeeWeeklySalesDashboardProps = {
  dispensarySlug: string;
  canCancel: boolean;
  canDepositOthers: boolean;
  canDelete: boolean;
  canViewAll: boolean;
  sessionUserId: string;
  initialSummary: WeeklySalesSummary;
  periodWeekDateValue: Date;
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
}: EmployeeWeeklySalesDashboardProps) {
  const queryClient = useQueryClient();
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<Date | null>(null);
  const [itemFilter, setItemFilter] = useState('');
  const [page, setPage] = useState(1);

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

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
      const result = await cancelSale(dispensarySlug, saleId);
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
      const result = await depositSaleInCashRegister(dispensarySlug, saleId);
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
      const result = await deleteSale(dispensarySlug, saleId);
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
      return true;
    });
  }, [summary.sales, employeeFilter, dayFilter, itemFilter]);

  const totalRecords = filteredSales.length;
  const maxPage = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE) || 1);
  const safePage = Math.min(page, maxPage);
  const paginatedSales = useMemo(
    () => filteredSales.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredSales, safePage],
  );

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
        width: 110,
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
                  Déposé
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
                <Button
                  size="xs"
                  variant="light"
                  color="danger"
                  loading={cancelMutation.isPending && cancelMutation.variables === sale.id}
                  onClick={() => cancelMutation.mutate(sale.id)}
                >
                  Annuler
                </Button>
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
  ]);

  return (
    <Stack gap="md">
      <Text className="disp-display-title">Ventes de la semaine</Text>

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

      {canViewAll && summary.byUser.length > 0 && (
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
            Détail
          </Text>
          {(employeeFilter || dayFilter || itemFilter.trim()) && (
            <Button
              variant="subtle"
              color="slate"
              size="xs"
              onClick={() => {
                setEmployeeFilter(null);
                setDayFilter(null);
                setItemFilter('');
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
          recordsPerPage={PAGE_SIZE}
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
