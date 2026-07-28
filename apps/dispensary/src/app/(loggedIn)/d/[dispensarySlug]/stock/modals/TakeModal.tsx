'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AppModal } from '@/app/_components/AppModal/AppModal';
import { useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { getItemsWithStock } from '@/app/_actions/stock';
import { handleAction } from '@/lib/action';
import { getEffectiveStockQuantity } from '@/lib/stock/ensureTodayStock';
import { stockKeys } from '@/lib/stock/queryKeys';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { sortItems } from '@/lib/stock/sortItemsByCategory';
import type { ChestListItem } from '@/types/chests';
import type { ItemWithRelations } from '@/types/stock';
import { useStockItems, useTakeMutation } from '../hooks/useStockQueries';

type TakeLine = {
  key: string;
  itemId: string;
  quantity: number | '';
  chestId: string | null;
};

type TakeModalProps = {
  opened: boolean;
  onClose: () => void;
  chests: ChestListItem[];
  initialChestId?: string | null;
};

async function fetchStockItemsForChest(dispensarySlug: string, chestId: string) {
  const result = await getItemsWithStock(dispensarySlug, chestId);
  return handleAction(result) as ItemWithRelations[];
}

export default function TakeModal({
  opened,
  onClose,
  chests,
  initialChestId = null,
}: TakeModalProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const [defaultChestId, setDefaultChestId] = useState<string | null>(initialChestId);
  const [lines, setLines] = useState<TakeLine[]>([]);
  const [itemToAdd, setItemToAdd] = useState<string | null>(null);

  const { data: defaultChestItems = [], isFetching } = useStockItems(defaultChestId, []);
  const takeMutation = useTakeMutation();

  const trackedChestIds = useMemo(() => {
    const ids = new Set<string>();
    if (defaultChestId) ids.add(defaultChestId);
    lines.forEach((line) => {
      if (line.chestId) ids.add(line.chestId);
    });
    return Array.from(ids);
  }, [defaultChestId, lines]);

  const extraChestQueries = useQueries({
    queries: trackedChestIds
      .filter((id) => id !== defaultChestId)
      .map((chestId) => ({
        queryKey: stockKeys.items(dispensarySlug, chestId),
        queryFn: () => fetchStockItemsForChest(dispensarySlug, chestId),
        enabled: opened && Boolean(dispensarySlug && chestId),
        staleTime: DEFAULT_STALE_TIME_MS,
      })),
  });

  const itemsByChest = useMemo(() => {
    const map: Record<string, ItemWithRelations[]> = {};
    if (defaultChestId) map[defaultChestId] = defaultChestItems;
    trackedChestIds
      .filter((id) => id !== defaultChestId)
      .forEach((chestId, index) => {
        const data = extraChestQueries[index]?.data;
        if (data) map[chestId] = data;
      });
    return map;
  }, [defaultChestId, defaultChestItems, trackedChestIds, extraChestQueries]);

  useEffect(() => {
    if (opened) {
      setDefaultChestId(initialChestId);
      setLines([]);
      setItemToAdd(null);
    }
  }, [opened, initialChestId]);

  const chestOptions = useMemo(
    () => chests.map((chest) => ({ value: chest.id, label: chest.name })),
    [chests],
  );

  const availableItems = useMemo(() => {
    return sortItems(
      defaultChestItems.filter((item) => {
        const qty = getEffectiveStockQuantity(item.stockToday, item.stockYesterday);
        return qty !== null && qty > 0;
      }),
    );
  }, [defaultChestItems]);

  const itemOptions = useMemo(() => {
    const selected = new Set(lines.map((line) => line.itemId));
    return availableItems
      .filter((item) => !selected.has(item.id))
      .map((item) => ({ value: item.id, label: item.name }));
  }, [availableItems, lines]);

  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of defaultChestItems) map.set(item.id, item.name);
    return map;
  }, [defaultChestItems]);

  const getAvailableInChest = (itemId: string, chestId: string | null): number => {
    if (!chestId) return 0;
    const items = itemsByChest[chestId] ?? [];
    const item = items.find((entry) => entry.id === itemId);
    return getEffectiveStockQuantity(item?.stockToday, item?.stockYesterday) ?? 0;
  };

  const handleAddLine = () => {
    if (!itemToAdd) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${itemToAdd}-${Date.now()}`,
        itemId: itemToAdd,
        quantity: 1,
        chestId: defaultChestId,
      },
    ]);
    setItemToAdd(null);
  };

  const handleSubmit = async () => {
    if (!defaultChestId) {
      notifications.show({
        title: 'Erreur',
        message: 'Sélectionnez un coffre source de base',
        color: 'danger',
      });
      return;
    }

    const payload = lines
      .map((line) => ({
        itemId: line.itemId,
        quantity: typeof line.quantity === 'number' ? line.quantity : 0,
        chestId: line.chestId || defaultChestId,
      }))
      .filter((line) => line.quantity > 0 && line.chestId);

    if (payload.length === 0) {
      notifications.show({
        title: 'Erreur',
        message: 'Ajoutez au moins un objet à prendre',
        color: 'danger',
      });
      return;
    }

    const invalid = payload.some((line) => {
      const available = getAvailableInChest(line.itemId, line.chestId);
      return line.quantity > available;
    });
    if (invalid) {
      notifications.show({
        title: 'Erreur',
        message: 'Quantité invalide pour un ou plusieurs objets',
        color: 'danger',
      });
      return;
    }

    try {
      await takeMutation.mutateAsync({
        defaultChestId,
        items: payload,
      });
      onClose();
    } catch {
      // notification handled by mutation
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title="Prendre des objets"
      size="xl"
      footer={
        <Group justify="flex-end">
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color="sage"
            onClick={handleSubmit}
            loading={takeMutation.isPending}
            disabled={!defaultChestId || lines.length === 0}
          >
            Confirmer la prise
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        <Select
          label="Coffre source de base"
          placeholder="Sélectionner un coffre"
          data={chestOptions}
          value={defaultChestId}
          onChange={setDefaultChestId}
          searchable
          required
        />

        <Group align="flex-end" grow>
          <Select
            label="Ajouter un objet"
            placeholder={isFetching ? 'Chargement…' : 'Choisir un objet'}
            data={itemOptions}
            value={itemToAdd}
            onChange={setItemToAdd}
            searchable
            disabled={!defaultChestId || isFetching}
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
                <Table.Th style={{ width: 200 }}>Coffre</Table.Th>
                <Table.Th style={{ width: 120 }}>Stock</Table.Th>
                <Table.Th style={{ width: 140 }}>Quantité</Table.Th>
                <Table.Th style={{ width: 48 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((line) => {
                const chestId = line.chestId || defaultChestId;
                const available = getAvailableInChest(line.itemId, chestId);
                const quantity = line.quantity;
                const invalid =
                  quantity !== '' &&
                  (typeof quantity !== 'number' || quantity <= 0 || quantity > available);

                return (
                  <Table.Tr key={line.key}>
                    <Table.Td>
                      <Text fw={500}>{itemNameById.get(line.itemId) ?? line.itemId}</Text>
                    </Table.Td>
                    <Table.Td>
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
                      />
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" color="denim">
                        {available}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={quantity}
                        min={1}
                        max={Math.max(available, 1)}
                        error={invalid}
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
                        onClick={() => setLines((prev) => prev.filter((entry) => entry.key !== line.key))}
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
