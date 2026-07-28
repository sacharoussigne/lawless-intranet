'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { createSale, getSellableItems } from '@/app/_actions/sales';
import { getChestsList } from '@/app/_actions/chests';
import { getItemsWithStock } from '@/app/_actions/stock';
import { handleAction } from '@/lib/action';
import { getEffectiveStockQuantity } from '@/lib/stock/ensureTodayStock';
import { stockKeys } from '@/lib/stock/queryKeys';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import type { ChestListItem } from '@/types/chests';
import type { ItemWithRelations } from '@/types/stock';
import { SaleItemSource } from '@prisma/client';

type SaleLine = {
  key: string;
  itemId: string;
  quantity: number | '';
  source: SaleItemSource;
  chestId: string | null;
};

type SellableItem = {
  id: string;
  name: string;
  price: number | null;
};

type SaleModalProps = {
  opened: boolean;
  onClose: () => void;
  initialChestId?: string | null;
  chests?: ChestListItem[];
  onCreated?: () => void;
};

export function SaleModal({
  opened,
  onClose,
  initialChestId = null,
  chests: chestsProp,
  onCreated,
}: SaleModalProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const queryClient = useQueryClient();
  const [defaultChestId, setDefaultChestId] = useState<string | null>(initialChestId);
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [itemToAdd, setItemToAdd] = useState<string | null>(null);

  const sellableQuery = useQuery({
    queryKey: ['sellable-items', dispensarySlug],
    queryFn: async () => handleAction(await getSellableItems(dispensarySlug)) as SellableItem[],
    enabled: opened && Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });

  const chestsQuery = useQuery({
    queryKey: ['chests-list', dispensarySlug, true],
    queryFn: async () => handleAction(await getChestsList(dispensarySlug, true)) as ChestListItem[],
    enabled: opened && Boolean(dispensarySlug) && !chestsProp,
    staleTime: DEFAULT_STALE_TIME_MS,
  });

  const chests = chestsProp ?? chestsQuery.data ?? [];

  const trackedChestIds = useMemo(() => {
    const ids = new Set<string>();
    if (defaultChestId) ids.add(defaultChestId);
    lines.forEach((line) => {
      if (line.source === SaleItemSource.CHEST && line.chestId) ids.add(line.chestId);
    });
    return Array.from(ids);
  }, [defaultChestId, lines]);

  const chestStockQueries = useQueries({
    queries: trackedChestIds.map((chestId) => ({
      queryKey: stockKeys.items(dispensarySlug, chestId),
      queryFn: async () =>
        handleAction(await getItemsWithStock(dispensarySlug, chestId)) as ItemWithRelations[],
      enabled: opened && Boolean(dispensarySlug && chestId),
      staleTime: DEFAULT_STALE_TIME_MS,
    })),
  });

  const itemsByChest = useMemo(() => {
    const map: Record<string, ItemWithRelations[]> = {};
    trackedChestIds.forEach((chestId, index) => {
      const data = chestStockQueries[index]?.data;
      if (data) map[chestId] = data;
    });
    return map;
  }, [trackedChestIds, chestStockQueries]);

  useEffect(() => {
    if (opened) {
      setDefaultChestId(initialChestId);
      setLines([]);
      setItemToAdd(null);
    }
  }, [opened, initialChestId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = lines
        .map((line) => ({
          itemId: line.itemId,
          quantity: typeof line.quantity === 'number' ? line.quantity : 0,
          source: line.source,
          chestId:
            line.source === SaleItemSource.CHEST
              ? line.chestId || defaultChestId
              : null,
        }))
        .filter((line) => line.quantity > 0);

      const result = await createSale(dispensarySlug, {
        defaultChestId,
        items: payload,
      });
      return handleAction(result);
    },
    onSuccess: () => {
      notifications.show({
        title: 'Succès',
        message: 'Vente enregistrée',
        color: 'moss',
      });
      void queryClient.invalidateQueries({ queryKey: ['weekly-sales', dispensarySlug] });
      for (const chestId of trackedChestIds) {
        void queryClient.invalidateQueries({ queryKey: stockKeys.items(dispensarySlug, chestId) });
      }
      void queryClient.invalidateQueries({ queryKey: stockKeys.items(dispensarySlug, null) });
      onCreated?.();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Erreur',
        message: error.message || 'Erreur lors de la vente',
        color: 'danger',
      });
    },
  });

  const sellableItems = sellableQuery.data ?? [];
  const chestOptions = chests.map((chest) => ({ value: chest.id, label: chest.name }));
  const itemOptions = useMemo(() => {
    const selected = new Set(lines.map((line) => line.itemId));
    return sellableItems
      .filter((item) => !selected.has(item.id))
      .map((item) => ({
        value: item.id,
        label: item.price != null ? `${item.name} (${item.price.toFixed(2)} $)` : item.name,
      }));
  }, [sellableItems, lines]);

  const getAvailableInChest = (itemId: string, chestId: string | null): number | null => {
    if (!chestId) return null;
    const items = itemsByChest[chestId] ?? [];
    const item = items.find((entry) => entry.id === itemId);
    return getEffectiveStockQuantity(item?.stockToday, item?.stockYesterday);
  };

  const estimatedTotal = lines.reduce((sum, line) => {
    const item = sellableItems.find((entry) => entry.id === line.itemId);
    const qty = typeof line.quantity === 'number' ? line.quantity : 0;
    return sum + (item?.price ?? 0) * qty;
  }, 0);

  const handleAddLine = () => {
    if (!itemToAdd) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${itemToAdd}-${Date.now()}`,
        itemId: itemToAdd,
        quantity: 1,
        source: defaultChestId ? SaleItemSource.CHEST : SaleItemSource.POCKET,
        chestId: defaultChestId,
      },
    ]);
    setItemToAdd(null);
  };

  const handleSubmit = () => {
    if (lines.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Ajoutez au moins un objet',
        color: 'danger',
      });
      return;
    }

    for (const line of lines) {
      if (typeof line.quantity !== 'number' || line.quantity <= 0) {
        notifications.show({
          title: 'Erreur',
          message: 'Quantité invalide',
          color: 'danger',
        });
        return;
      }
      if (line.source === SaleItemSource.CHEST) {
        const chestId = line.chestId || defaultChestId;
        if (!chestId) {
          notifications.show({
            title: 'Erreur',
            message: 'Sélectionnez un coffre pour les objets en coffre',
            color: 'danger',
          });
          return;
        }
        const available = getAvailableInChest(line.itemId, chestId);
        if (available === null || line.quantity > available) {
          notifications.show({
            title: 'Erreur',
            message: 'Stock insuffisant pour un objet provenant d\'un coffre',
            color: 'danger',
          });
          return;
        }
      }
    }

    createMutation.mutate();
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Nouvelle vente"
      size="xl"
      footer={
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            Total estimé : {estimatedTotal.toFixed(2)} $
          </Text>
          <Group>
            <Button variant="subtle" color="slate" onClick={onClose}>
              Annuler
            </Button>
            <Button color="sage" onClick={handleSubmit} loading={createMutation.isPending}>
              Enregistrer la vente
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack gap="md">
        <Select
          label="Coffre source de base"
          description="Utilisé pour les lignes en provenance d’un coffre"
          placeholder="Optionnel"
          data={chestOptions}
          value={defaultChestId}
          onChange={setDefaultChestId}
          clearable
          searchable
        />

        <Group align="flex-end" grow>
          <Select
            label="Ajouter un objet vendable"
            placeholder="Choisir un objet"
            data={itemOptions}
            value={itemToAdd}
            onChange={setItemToAdd}
            searchable
            disabled={sellableQuery.isFetching}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleAddLine}
            disabled={!itemToAdd}
            variant="light"
          >
            Ajouter
          </Button>
        </Group>

        {lines.length === 0 ? (
          <Text c="dimmed" size="sm">
            Aucun objet sélectionné.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Objet</Table.Th>
                <Table.Th style={{ width: 160 }}>Provenance</Table.Th>
                <Table.Th style={{ width: 180 }}>Coffre</Table.Th>
                <Table.Th style={{ width: 100 }}>Stock</Table.Th>
                <Table.Th style={{ width: 120 }}>Qté</Table.Th>
                <Table.Th style={{ width: 48 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((line) => {
                const item = sellableItems.find((entry) => entry.id === line.itemId);
                const chestId = line.chestId || defaultChestId;
                const available =
                  line.source === SaleItemSource.CHEST
                    ? getAvailableInChest(line.itemId, chestId)
                    : null;

                return (
                  <Table.Tr key={line.key}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={500}>{item?.name ?? line.itemId}</Text>
                        <Text size="xs" c="dimmed">
                          {item?.price != null ? `${item.price.toFixed(2)} $` : 'Sans prix'}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <SegmentedControl
                        size="xs"
                        value={line.source}
                        onChange={(value) =>
                          setLines((prev) =>
                            prev.map((entry) =>
                              entry.key === line.key
                                ? {
                                    ...entry,
                                    source: value as SaleItemSource,
                                    chestId:
                                      value === SaleItemSource.CHEST
                                        ? entry.chestId || defaultChestId
                                        : null,
                                  }
                                : entry,
                            ),
                          )
                        }
                        data={[
                          { label: 'Coffre', value: SaleItemSource.CHEST },
                          { label: 'Poche', value: SaleItemSource.POCKET },
                        ]}
                      />
                    </Table.Td>
                    <Table.Td>
                      {line.source === SaleItemSource.CHEST ? (
                        <Select
                          data={chestOptions}
                          value={chestId}
                          onChange={(value) =>
                            setLines((prev) =>
                              prev.map((entry) =>
                                entry.key === line.key ? { ...entry, chestId: value } : entry,
                              ),
                            )
                          }
                          size="xs"
                          placeholder="Coffre"
                        />
                      ) : (
                        <Badge variant="outline" color="slate">
                          Poche
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {line.source === SaleItemSource.CHEST ? (
                        <Badge variant="outline" color="denim">
                          {available ?? '—'}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={line.quantity}
                        min={1}
                        max={
                          line.source === SaleItemSource.CHEST && available != null
                            ? Math.max(available, 1)
                            : undefined
                        }
                        onChange={(value) =>
                          setLines((prev) =>
                            prev.map((entry) =>
                              entry.key === line.key
                                ? { ...entry, quantity: typeof value === 'number' ? value : '' }
                                : entry,
                            ),
                          )
                        }
                        size="xs"
                      />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="light"
                        color="danger"
                        onClick={() =>
                          setLines((prev) => prev.filter((entry) => entry.key !== line.key))
                        }
                        aria-label="Retirer"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </AppModal>
  );
}
