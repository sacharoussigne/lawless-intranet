'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { WeekNavigation } from '@/app/_components/WeekNavigation/WeekNavigation';
import { cancelSale, listWeeklySales, type WeeklySalesSummary } from '@/app/_actions/sales';
import { handleAction } from '@/lib/action';
import {
  addParisWeeks,
  clampParisWeekDateToMax,
  getBankWeekBounds,
  getCurrentParisWeekStart,
} from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { SaleStatus } from '@prisma/client';
import { apothecaryBooleanPills, apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette } from '@/lib/design-tokens';

type EmployeeWeeklySalesDashboardProps = {
  dispensarySlug: string;
  canCancel: boolean;
  canViewAll: boolean;
  sessionUserId: string;
  initialSummary: WeeklySalesSummary;
};

export function EmployeeWeeklySalesDashboard({
  dispensarySlug,
  canCancel,
  canViewAll,
  sessionUserId,
  initialSummary,
}: EmployeeWeeklySalesDashboardProps) {
  const queryClient = useQueryClient();
  const currentParisWeekStart = getCurrentParisWeekStart();
  const [periodWeekDateValue, setPeriodWeekDateValue] = useState<Date>(() =>
    getBankWeekBounds(dayjs().tz('Europe/Paris').startOf('day').toDate()).start,
  );

  const currentWeekBounds = useMemo(
    () => getBankWeekBounds(periodWeekDateValue),
    [periodWeekDateValue],
  );

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

  return (
    <Stack gap="md" mb="xl">
      <Group justify="space-between" align="center">
        <Text className="disp-display-title">Ventes de la semaine</Text>
        <WeekNavigation
          weekStart={currentWeekBounds.start}
          weekEnd={currentWeekBounds.end}
          weekDateValue={periodWeekDateValue}
          maxWeekStart={currentParisWeekStart}
          onWeekChange={(date) => {
            if (date) {
              setPeriodWeekDateValue(clampParisWeekDateToMax(date, currentParisWeekStart));
            }
          }}
          onPreviousWeek={() => setPeriodWeekDateValue((d) => addParisWeeks(d, -1))}
          onNextWeek={() =>
            setPeriodWeekDateValue((d) =>
              clampParisWeekDateToMax(addParisWeeks(d, 1), currentParisWeekStart),
            )
          }
          loading={salesQuery.isFetching}
        />
      </Group>

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
        <Text size="sm" fw={600} mb="sm">
          Détail
        </Text>
        {summary.sales.length === 0 ? (
          <Text c="dimmed" size="sm">
            Aucune vente sur cette semaine.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                {canViewAll && <Table.Th>Employé</Table.Th>}
                <Table.Th>Objets</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th style={{ width: 120 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {summary.sales.map((sale) => {
                const canCancelSale =
                  canCancel &&
                  sale.status === SaleStatus.COMPLETED &&
                  (sale.userId === sessionUserId || canViewAll);

                return (
                  <Table.Tr key={sale.id}>
                    <Table.Td>
                      {dayjs(sale.createdAt).tz('Europe/Paris').format('DD/MM HH:mm')}
                    </Table.Td>
                    {canViewAll && <Table.Td>{sale.userName}</Table.Td>}
                    <Table.Td>
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
                    </Table.Td>
                    <Table.Td>{sale.totalAmount.toFixed(2)} $</Table.Td>
                    <Table.Td>
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
                    </Table.Td>
                    <Table.Td>
                      {canCancelSale && (
                        <Button
                          size="xs"
                          variant="light"
                          color="danger"
                          loading={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(sale.id)}
                        >
                          Annuler
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
