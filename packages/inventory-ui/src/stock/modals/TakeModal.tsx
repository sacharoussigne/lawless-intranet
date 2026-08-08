'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  ScrollArea,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useInventoryUi } from '../../InventoryUiProvider';
import { unwrapActionResult } from '../../lib/actionResult';
import { getEffectiveStockQuantity } from '../../lib/ensureTodayStock';
import { DEFAULT_STALE_TIME_MS, stockKeys } from '../../lib/queryKeys';
import { sortItems } from '../../lib/sortItemsByCategory';
import type { ChestListItem, ChestStockMoveMode, ItemWithRelations } from '../../types';
import { useStockItems, useChestStockMoveMutation } from '../hooks/useStockQueries';

type MoveLine = {
  key: string;
  itemId: string;
  quantity: number | '';
  chestId: string | null;
};

type TakeDepositModalProps = {
  opened: boolean;
  onClose: () => void;
  chests: ChestListItem[];
  initialChestId?: string | null;
};

export default function TakeDepositModal({
  opened,
  onClose,
  chests,
  initialChestId = null,
}: TakeDepositModalProps) {
  const { scopeKey, actions } = useInventoryUi();
  const [mode, setMode] = useState<ChestStockMoveMode>('take');
  const [defaultChestId, setDefaultChestId] = useState<string | null>(initialChestId);
  const [lines, setLines] = useState<MoveLine[]>([]);

  const { data: defaultChestItems = [], isFetching } = useStockItems(defaultChestId, undefined, {
    enabled: opened && Boolean(defaultChestId),
  });
  const moveMutation = useChestStockMoveMutation();

  const isTake = mode === 'take';

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
        queryKey: stockKeys.items(scopeKey, chestId),
        queryFn: async () =>
          unwrapActionResult(await actions.getItemsWithStock(chestId)) as ItemWithRelations[],
        enabled: opened && Boolean(scopeKey && chestId),
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
      setMode('take');
      setDefaultChestId(initialChestId);
      setLines([]);
    }
  }, [opened, initialChestId]);

  useEffect(() => {
    setLines([]);
  }, [mode]);

  const chestOptions = useMemo(
    () => chests.map((chest) => ({ value: chest.id, label: chest.name })),
    [chests],
  );

  const availableItems = useMemo(() => {
    if (isTake) {
      return sortItems(
        defaultChestItems.filter((item) => {
          const qty = getEffectiveStockQuantity(item.stockToday, item.stockYesterday);
          return qty !== null && qty > 0;
        }),
      );
    }
    return sortItems(defaultChestItems);
  }, [defaultChestItems, isTake]);

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

  const canSubmit = useMemo(() => {
    if (!defaultChestId || lines.length === 0) return false;

    return lines.every((line) => {
      const chestId = line.chestId || defaultChestId;
      if (!chestId) return false;
      if (typeof line.quantity !== 'number' || line.quantity <= 0) return false;
      if (isTake && line.quantity > getAvailableInChest(line.itemId, chestId)) return false;
      return true;
    });
  }, [defaultChestId, lines, isTake, itemsByChest]);

  const handleAddLine = (itemId: string) => {
    setLines((prev) => [
      ...prev,
      {
        key: `${itemId}-${Date.now()}`,
        itemId,
        quantity: 1,
        chestId: defaultChestId,
      },
    ]);
  };

  const handleSubmit = async () => {
    if (!defaultChestId) {
      notifications.show({
        title: 'Erreur',
        message: isTake
          ? 'Sélectionnez un coffre source de base'
          : 'Sélectionnez un coffre de destination de base',
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
        message: isTake
          ? 'Ajoutez au moins un objet à prendre'
          : 'Ajoutez au moins un objet à déposer',
        color: 'danger',
      });
      return;
    }

    if (isTake) {
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
    }

    try {
      await moveMutation.mutateAsync({
        mode,
        defaultChestId,
        items: payload,
      });
      onClose();
    } catch {
      // notification handled by mutation
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Prendre / Déposer"
      size="xl"
      yOffset={60}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as ChestStockMoveMode)}
          data={[
            { label: 'Prendre', value: 'take' },
            { label: 'Déposer', value: 'deposit' },
          ]}
        />

        <Select
          label={isTake ? 'Coffre source de base' : 'Coffre de destination de base'}
          placeholder={chests.length === 0 ? 'Aucun coffre accessible' : 'Sélectionner un coffre'}
          data={chestOptions}
          value={defaultChestId}
          onChange={setDefaultChestId}
          searchable
          required
          disabled={chests.length === 0}
          description={
            chests.length === 0
              ? 'Aucun coffre accessible avec votre rôle.'
              : undefined
          }
        />

        <Select
          label="Ajouter un objet"
          placeholder={isFetching ? 'Chargement…' : 'Choisir un objet'}
          data={itemOptions}
          value={null}
          onChange={(value) => {
            if (value) handleAddLine(value);
          }}
          searchable
          disabled={!defaultChestId || isFetching}
        />

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
                  (typeof quantity !== 'number' ||
                    quantity <= 0 ||
                    (isTake && quantity > available));

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
                        max={isTake ? Math.max(available, 1) : undefined}
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

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color="sage"
            onClick={handleSubmit}
            loading={moveMutation.isPending}
            disabled={!canSubmit}
          >
            {isTake ? 'Confirmer la prise' : 'Confirmer le dépôt'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
