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
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  ScrollArea,
} from '@mantine/core';
import { IconArrowBarToDown, IconArrowBarToUp, IconTrash } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
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
  const isMobile = useMediaQuery('(max-width: 47.99em)') ?? false;
  const [mode, setMode] = useState<ChestStockMoveMode>('deposit');
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
      setMode('deposit');
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

  /** Controls of one line, laid out as a table row (desktop) or a card (phones). */
  const lineControls = (line: MoveLine, size: 'xs' | 'sm') => {
    const chestId = line.chestId || defaultChestId;
    const available = getAvailableInChest(line.itemId, chestId);
    const quantity = line.quantity;
    const invalid =
      quantity !== '' &&
      (typeof quantity !== 'number' || quantity <= 0 || (isTake && quantity > available));
    const updateLine = (patch: (entry: MoveLine) => MoveLine) =>
      setLines((prev) => prev.map((entry) => (entry.key === line.key ? patch(entry) : entry)));

    return {
      name: (
        <Text fw={500} style={{ minWidth: 0 }}>
          {itemNameById.get(line.itemId) ?? line.itemId}
        </Text>
      ),
      chest: (
        <Select
          data={chestOptions}
          value={chestId}
          onChange={(value) => updateLine((entry) => ({ ...entry, chestId: value }))}
          size={size}
        />
      ),
      stock: (
        <Badge variant="outline" color="denim">
          {available}
        </Badge>
      ),
      quantity: (
        <NumberInput
          value={quantity}
          min={1}
          max={isTake ? Math.max(available, 1) : undefined}
          error={invalid}
          onChange={(value) =>
            updateLine((entry) => ({ ...entry, quantity: typeof value === 'number' ? value : '' }))
          }
          size={size}
        />
      ),
      remove: (
        <ActionIcon
          variant="light"
          color="danger"
          size={size === 'sm' ? 'lg' : 'md'}
          onClick={() => setLines((prev) => prev.filter((entry) => entry.key !== line.key))}
          aria-label="Retirer"
        >
          <IconTrash size={16} />
        </ActionIcon>
      ),
    };
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Déposer / Prendre"
      size="xl"
      yOffset={60}
      scrollAreaComponent={ScrollArea.Autosize}
      // Phones: full screen sheet sliding up.
      fullScreen={isMobile}
      transitionProps={isMobile ? { transition: 'slide-up', duration: 200 } : undefined}
    >
      <Stack gap="md">
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as ChestStockMoveMode)}
          data={[
            {
              value: 'deposit',
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <IconArrowBarToDown size={16} />
                  <span style={{ paddingTop: "4px" }}>Déposer</span>
                </Group>
              ),
            },
            {
              value: 'take',
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <IconArrowBarToUp size={16} />
                  <span style={{ paddingTop: "4px" }}>Prendre</span>
                </Group>
              ),
            },
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
          <>
            <Table striped highlightOnHover visibleFrom="sm">
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
                  const view = lineControls(line, 'xs');
                  return (
                    <Table.Tr key={line.key}>
                      <Table.Td>{view.name}</Table.Td>
                      <Table.Td>{view.chest}</Table.Td>
                      <Table.Td>{view.stock}</Table.Td>
                      <Table.Td>{view.quantity}</Table.Td>
                      <Table.Td>{view.remove}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {/* Phones: one card per line instead of the table. */}
            <Stack gap="sm" hiddenFrom="sm">
              {lines.map((line) => {
                const view = lineControls(line, 'sm');
                return (
                  <Paper key={line.key} withBorder radius="md" p="sm">
                    <Stack gap="xs">
                      <Group justify="space-between" wrap="nowrap">
                        {view.name}
                        {view.remove}
                      </Group>
                      <Group gap="xs" wrap="nowrap" align="center">
                        <div style={{ flex: 1, minWidth: 0 }}>{view.chest}</div>
                        {view.stock}
                      </Group>
                      <Group gap="xs" wrap="nowrap" align="center">
                        <Text size="sm" c="dimmed">
                          Quantité
                        </Text>
                        <div style={{ flex: 1 }}>{view.quantity}</div>
                      </Group>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </>
        )}

        <Group justify="flex-end" mt="md" grow={isMobile}>
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
