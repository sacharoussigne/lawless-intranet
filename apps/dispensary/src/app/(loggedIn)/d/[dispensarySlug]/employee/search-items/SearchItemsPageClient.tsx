'use client';

import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Container,
  Title,
  Paper,
  MultiSelect,
  Stack,
  Group,
  Text,
  Table,
  Badge,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { getStockPreviousColumnLabel, getStockTotalPreviousLabel } from '@/lib/stock/stockPreviousLabel';
import { apothecaryBooleanPills } from '@/lib/apothecaryPill';
import { stockKeys } from '@/lib/stock/queryKeys';
import type { ItemWithRelations } from '@/types/items';
import type { StockItemWithStockRecord } from '@lawless-intranet/types';

type ItemWithDetailedStock = StockItemWithStockRecord;

interface SearchItemsPageClientProps {
  initialItems: ItemWithRelations[];
}

export default function SearchItemsPageClient({
  initialItems,
}: SearchItemsPageClientProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Kept fresh by the stock realtime (`['stock', slug]`).
  const detailsQuery = useQuery({
    queryKey: stockKeys.detailed(dispensarySlug, selectedItemIds),
    queryFn: async (): Promise<ItemWithDetailedStock[]> =>
      handleAction(await fetchRead(dispensarySlug, 'itemsWithDetailedStock', { itemIds: selectedItemIds })) ?? [],
    enabled: selectedItemIds.length > 0,
    placeholderData: keepPreviousData,
  });
  const itemsWithStock = selectedItemIds.length > 0 ? (detailsQuery.data ?? []) : [];
  const loading = detailsQuery.isFetching && detailsQuery.isPlaceholderData;

  const itemOptions = initialItems.map((item) => ({
    value: item.id,
    label: item.name,
  }));


  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        <Title order={1}>Recherche d'items</Title>

        <Paper shadow="sm" p="md" withBorder>
          <Stack gap="md">
            <MultiSelect
              label="Sélectionner des items"
              placeholder="Rechercher et sélectionner des items"
              data={itemOptions}
              value={selectedItemIds}
              onChange={setSelectedItemIds}
              searchable
              clearable
              maxDropdownHeight={300}
            />

            {detailsQuery.isError ? (
              <Alert color="danger">
                {detailsQuery.error instanceof Error
                  ? detailsQuery.error.message
                  : 'Erreur lors du chargement des détails des items'}
              </Alert>
            ) : null}

            {itemsWithStock.length > 0 && (
              <Stack gap="lg" mt="md">
                {itemsWithStock.map((item) => {
                  const stockByChest = item.stockByChest ?? [];
                  const previousStockColumnLabel = getStockPreviousColumnLabel(
                    stockByChest.map((chestStock) => chestStock.stockPreviousAt),
                  );
                  const totalPreviousLabel = getStockTotalPreviousLabel([
                    item.stockPreviousAt,
                    ...stockByChest.map((chestStock) => chestStock.stockPreviousAt),
                  ]);

                  return (
                  <Paper key={item.id} shadow="xs" p="md" withBorder pos="relative">
                    <LoadingOverlay visible={loading} />
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap="xs">
                          <Group gap="xs">
                            <Text fw={600} size="lg">
                              {item.name}
                            </Text>
                            {item.category && (
                              <Badge
                                style={{
                                  backgroundColor: item.category.color,
                                  color: '#000',
                                }}
                                variant="filled"
                              >
                                {item.category.name}
                              </Badge>
                            )}
                            {item.isCraftable && (
                              <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.yes}>
                                Craftable
                              </Badge>
                            )}
                            {item.canBeSold && (
                              <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.commerce}>
                                Peut être vendu
                              </Badge>
                            )}
                          </Group>
                          {item.description && (
                            <Text size="sm" c="dimmed">
                              {item.description}
                            </Text>
                          )}
                          {item.companyGroup && (
                            <Text size="sm" c="dimmed">
                              Groupe d'entreprise : {item.companyGroup.name}
                            </Text>
                          )}
                          <Group gap="md">
                            <Text size="sm">
                              <Text span fw={500}>
                                Quantité minimale :
                              </Text>{' '}
                              {item.minimalQuantity}
                            </Text>
                            {item.price !== null && (
                              <Text size="sm">
                                <Text span fw={500}>
                                  Prix :
                                </Text>{' '}
                                {item.price.toFixed(2)} €
                              </Text>
                            )}
                          </Group>
                        </Stack>
                        <Stack gap="xs" align="flex-end">
                          <Group gap="md">
                            <Stack gap={2} align="flex-end">
                              <Text size="xs" c="dimmed">
                                {totalPreviousLabel}
                              </Text>
                              <Text size="lg" fw={500} c="dimmed">
                                {item.stockYesterday !== null ? item.stockYesterday : '?'}
                              </Text>
                            </Stack>
                            <Stack gap={2} align="flex-end">
                              <Text size="xs" c="dimmed">
                                Stock total aujourd'hui
                              </Text>
                              <Text size="xl" fw={700} c={item.stockToday !== null ? 'blue' : 'dimmed'}>
                                {item.stockToday !== null ? item.stockToday : '?'}
                              </Text>
                            </Stack>
                          </Group>
                        </Stack>
                      </Group>

                      <Table striped highlightOnHover mt="md">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Coffre</Table.Th>
                            <Table.Th>{previousStockColumnLabel}</Table.Th>
                            <Table.Th>Stock aujourd'hui</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {stockByChest.map((chestStock) => (
                            <Table.Tr key={chestStock.chestId}>
                              <Table.Td>
                                <Text fw={500}>{chestStock.chestName}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Text c="dimmed">
                                  {chestStock.stockYesterday !== null ? chestStock.stockYesterday : '?'}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text c={chestStock.stockToday !== null ? 'blue' : 'dimmed'}>
                                  {chestStock.stockToday !== null ? chestStock.stockToday : '?'}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Paper>
                  );
                })}
              </Stack>
            )}

            {selectedItemIds.length > 0 && itemsWithStock.length === 0 && !loading && (
              <Text c="dimmed" ta="center" py="xl">
                Aucune information de stock disponible pour les items sélectionnés
              </Text>
            )}

            {selectedItemIds.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                Sélectionnez des items pour voir leurs informations détaillées
              </Text>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
