'use client';

import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Checkbox,
  Select,
  Stack,
  Switch,
  Table,
  Text,
} from '@mantine/core';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { useRequiredDispensarySlug, usePermissions } from '@/app/_contexts/PermissionsContext';
import { getChestsList } from '@/app/_actions/chests';
import { getItemsWithStock } from '@/app/_actions/stock';
import { handleAction } from '@/lib/action';
import { getEffectiveStockQuantity } from '@/lib/stock/ensureTodayStock';
import { stockKeys } from '@/lib/stock/queryKeys';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';
import { apothecaryBooleanPills, apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette, dangerPalette, denimPalette } from '@/lib/design-tokens';
import type { ChestListItem } from '@/types/chests';
import type { ItemWithRelations } from '@/types/stock';
import { OrderTypeEnum } from '@/types/enum/orderType';
import { RpDateInput } from '@/app/_components/RpDatePicker/RpDateInput';
import { getTodayRealDate } from '@/lib/rpCalendar';
import {
  getBankTransactionTypeLabelForOrder,
  resolveBankTransactionNameForOrder,
} from '@/lib/bank/orderTransactionLabels';
import { useCompleteOrderMutation } from '../hooks/useOrdersQueries';

export type CompleteOrderPendingPayload = {
  id: string;
  name: string;
  type: OrderTypeEnum;
  details?: string;
  price?: number | null;
  items: { itemId: string; quantity: number }[];
  company?: { name: string; bankAccountNumber: string | null } | null;
  individualCustomerName?: string | null;
};

export type CompleteOrderStockLine = {
  itemId: string;
  quantity: number;
  name: string;
  isEnabled: boolean;
};

type LineState = {
  itemId: string;
  quantity: number;
  name: string;
  selected: boolean;
  chestId: string | null;
};

type CompleteOrderStockModalProps = {
  opened: boolean;
  onClose: () => void;
  onCompleted: () => void;
  orderType: OrderTypeEnum;
  pending: CompleteOrderPendingPayload | null;
  lines: CompleteOrderStockLine[];
};

function buildInitialLineStates(
  enabledLines: CompleteOrderStockLine[],
  defaultChestId: string | null,
): LineState[] {
  return enabledLines.map((line) => ({
    itemId: line.itemId,
    quantity: line.quantity,
    name: line.name,
    selected: true,
    chestId: defaultChestId,
  }));
}

type CompleteOrderStockBodyProps = {
  opened: boolean;
  dispensarySlug: string;
  isIncoming: boolean;
  pending: CompleteOrderPendingPayload;
  enabledLines: CompleteOrderStockLine[];
  firstChestId: string | null;
  chestOptions: { value: string; label: string }[];
  onClose: () => void;
  onCompleted: () => void;
};

function CompleteOrderStockBody({
  opened,
  dispensarySlug,
  isIncoming,
  pending,
  enabledLines,
  firstChestId,
  chestOptions,
  onClose,
  onCompleted,
}: CompleteOrderStockBodyProps) {
  const completeMutation = useCompleteOrderMutation();
  const { appSettings } = usePermissions();
  const bankFeatureEnabled = appSettings.featureBankEnabled;

  const [createBankTransaction, setCreateBankTransaction] = useState(
    () => bankFeatureEnabled,
  );
  const [bankTransactionDate, setBankTransactionDate] = useState<Date | null>(() =>
    getTodayRealDate(),
  );

  const [skipStock, setSkipStock] = useState(() => enabledLines.length === 0);
  const [defaultChestId, setDefaultChestId] = useState<string | null>(firstChestId);
  const [lineStates, setLineStates] = useState<LineState[]>(() =>
    buildInitialLineStates(enabledLines, firstChestId),
  );

  const bankTransactionName = resolveBankTransactionNameForOrder({
    name: pending.name,
    company: pending.company,
    individualCustomer: pending.individualCustomerName
      ? { name: pending.individualCustomerName }
      : null,
  });
  const bankTransactionTypeLabel = getBankTransactionTypeLabelForOrder(pending.type);
  const hasValidPrice = pending.price != null && pending.price > 0;
  const bankBlocked = createBankTransaction && (!hasValidPrice || !bankTransactionDate);

  const trackedChestIds = useMemo(() => {
    const ids = new Set<string>();
    if (defaultChestId) ids.add(defaultChestId);
    lineStates.forEach((line) => {
      if (line.chestId) ids.add(line.chestId);
    });
    return Array.from(ids);
  }, [defaultChestId, lineStates]);

  const chestStockQueries = useQueries({
    queries: trackedChestIds.map((chestId) => ({
      queryKey: stockKeys.items(dispensarySlug, chestId),
      queryFn: async () =>
        handleAction(await getItemsWithStock(dispensarySlug, chestId)) as ItemWithRelations[],
      enabled: !skipStock && Boolean(dispensarySlug && chestId),
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

  const getStockInfo = (itemId: string, chestId: string | null) => {
    if (!chestId) return { stock: null as number | null, isToday: true };
    const items = itemsByChest[chestId] ?? [];
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return { stock: null as number | null, isToday: true };
    if (item.stockToday != null) return { stock: item.stockToday, isToday: true };
    return {
      stock: getEffectiveStockQuantity(item.stockToday, item.stockYesterday),
      isToday: false,
    };
  };

  const selectedLines = lineStates.filter((line) => line.selected);
  const missingChest = selectedLines.some((line) => !line.chestId);
  const insufficientStock =
    !isIncoming &&
    !skipStock &&
    selectedLines.some((line) => {
      const resolvedChestId = line.chestId || defaultChestId;
      const { stock } = getStockInfo(line.itemId, resolvedChestId);
      return stock == null || stock < line.quantity;
    });

  const canConfirm =
    !completeMutation.isPending &&
    !bankBlocked &&
    (skipStock ||
      enabledLines.length === 0 ||
      (selectedLines.length === 0 && !missingChest) ||
      (!missingChest && !insufficientStock && selectedLines.every((l) => l.chestId)));

  const handleConfirm = async () => {
    const stockLines =
      skipStock || enabledLines.length === 0
        ? []
        : selectedLines.flatMap((line) =>
            line.chestId
              ? [
                  {
                    itemId: line.itemId,
                    quantity: line.quantity,
                    chestId: line.chestId,
                  },
                ]
              : [],
          );

    try {
      await completeMutation.mutateAsync({
        id: pending.id,
        name: pending.name,
        type: pending.type,
        details: pending.details,
        price: pending.price,
        items: pending.items,
        skipStock: skipStock || stockLines.length === 0,
        stockLines,
        createBankTransaction: bankFeatureEnabled && createBankTransaction,
        bankTransactionDate:
          bankFeatureEnabled && createBankTransaction ? bankTransactionDate : undefined,
        affectedChestIds: stockLines.map((line) => line.chestId),
      });
      window.setTimeout(() => {
        onCompleted();
      }, 0);
    } catch {
      // Error notification is handled by the mutation hook.
    }
  };

  const skipLabel = isIncoming
    ? 'Ne rien ajouter au stock'
    : 'Ne rien retirer du stock';

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={isIncoming ? 'Terminer — ajouter au stock' : 'Terminer — retirer du stock'}
      size="xl"
      footer={
        <AppModalFooter>
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            loading={completeMutation.isPending}
          >
            Confirmer
          </Button>
        </AppModalFooter>
      }
    >
      <Stack gap="md">
        <Switch
          label={skipLabel}
          checked={skipStock}
          onChange={(event) => setSkipStock(event.currentTarget.checked)}
          disabled={enabledLines.length === 0}
        />

        {bankFeatureEnabled ? (
          <Stack gap="sm">
            <Checkbox
              label="Créer une transaction bancaire"
              checked={createBankTransaction}
              onChange={(event) => setCreateBankTransaction(event.currentTarget.checked)}
            />
            {createBankTransaction ? (
              <Stack gap="xs">
                <RpDateInput
                  label="Date de la transaction"
                  value={bankTransactionDate}
                  onChange={setBankTransactionDate}
                  required
                />
                <Text size="sm" c="dimmed">
                  {bankTransactionTypeLabel}
                  {' · '}
                  {hasValidPrice ? `${Number(pending.price).toFixed(2)} $` : 'Prix manquant'}
                  {' · '}
                  {bankTransactionName}
                </Text>
                {!hasValidPrice ? (
                  <Text size="sm" c="danger">
                    Ajoutez un prix à la commande pour créer la transaction.
                  </Text>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {enabledLines.length === 0 ? (
          <Text size="sm" c="dimmed">
            Aucun article activé dans cette commande. La commande sera terminée sans mouvement
            de stock.
          </Text>
        ) : skipStock ? (
          <Text size="sm" c="dimmed">
            Aucun mouvement de stock ne sera effectué.
          </Text>
        ) : (
          <>
            <Select
              label="Coffre par défaut"
              data={chestOptions}
              value={defaultChestId}
              onChange={(value) => {
                setDefaultChestId(value);
                setLineStates((current) =>
                  current.map((line) => ({
                    ...line,
                    chestId: value,
                  })),
                );
              }}
              searchable
              placeholder="Choisir un coffre"
            />

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 48 }} />
                  <Table.Th>Article</Table.Th>
                  <Table.Th style={{ width: 200 }}>Coffre</Table.Th>
                  {!isIncoming && <Table.Th style={{ width: 120 }}>Stock</Table.Th>}
                  <Table.Th style={{ width: 90 }}>Qté</Table.Th>
                  {!isIncoming && <Table.Th style={{ width: 70 }}>Statut</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lineStates.map((line) => {
                  const stockInfo = getStockInfo(line.itemId, line.chestId);
                  const hasEnough =
                    stockInfo.stock != null && stockInfo.stock >= line.quantity;

                  return (
                    <Table.Tr key={line.itemId}>
                      <Table.Td>
                        <Checkbox
                          checked={line.selected}
                          onChange={(event) => {
                            const selected = event.currentTarget.checked;
                            setLineStates((current) =>
                              current.map((entry) =>
                                entry.itemId === line.itemId
                                  ? { ...entry, selected }
                                  : entry,
                              ),
                            );
                          }}
                          aria-label={`Inclure ${line.name}`}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{line.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Select
                          data={chestOptions}
                          value={line.chestId}
                          onChange={(value) => {
                            setLineStates((current) =>
                              current.map((entry) =>
                                entry.itemId === line.itemId
                                  ? { ...entry, chestId: value }
                                  : entry,
                              ),
                            );
                          }}
                          size="xs"
                          disabled={!line.selected}
                          searchable
                        />
                      </Table.Td>
                      {!isIncoming && (
                        <Table.Td>
                          {stockInfo.stock !== null ? (
                            <Badge
                              variant="outline"
                              style={apothecaryPillStyle(
                                stockInfo.isToday ? denimPalette : amberPalette,
                              )}
                            >
                              {stockInfo.stock}
                              {stockInfo.isToday ? '' : ' (hier)'}
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                      )}
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {line.quantity}
                        </Text>
                      </Table.Td>
                      {!isIncoming && (
                        <Table.Td>
                          {!line.selected ? (
                            <Text size="xs" c="dimmed">
                              —
                            </Text>
                          ) : hasEnough ? (
                            <Badge
                              variant="outline"
                              style={apothecaryBooleanPills.yes}
                              size="sm"
                            >
                              ✓
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              style={apothecaryPillStyle(
                                stockInfo.isToday ? dangerPalette : amberPalette,
                              )}
                              size="sm"
                            >
                              ✗
                            </Badge>
                          )}
                        </Table.Td>
                      )}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {insufficientStock && (
              <Text size="sm" c="danger">
                Stock insuffisant pour une ou plusieurs lignes cochées.
              </Text>
            )}
          </>
        )}
      </Stack>
    </AppModal>
  );
}

export function CompleteOrderStockModal({
  opened,
  onClose,
  onCompleted,
  orderType,
  pending,
  lines: sourceLines,
}: CompleteOrderStockModalProps) {
  const dispensarySlug = useRequiredDispensarySlug();
  const isIncoming = orderType === OrderTypeEnum.INCOMING;

  const enabledLines = useMemo(
    () => sourceLines.filter((line) => line.isEnabled),
    [sourceLines],
  );

  const chestsQuery = useQuery({
    queryKey: ['chests-list', dispensarySlug, true],
    queryFn: async () =>
      handleAction(await getChestsList(dispensarySlug, true)) as ChestListItem[],
    enabled: opened && Boolean(dispensarySlug),
    staleTime: DEFAULT_STALE_TIME_MS,
  });

  const chests = chestsQuery.data;
  const firstChestId = chests?.[0]?.id ?? null;
  const chestOptions = useMemo(
    () => (chests ?? []).map((chest) => ({ value: chest.id, label: chest.name })),
    [chests],
  );

  const enabledLinesKey = useMemo(
    () =>
      enabledLines.map((line) => `${line.itemId}:${line.quantity}:${line.name}`).join('|'),
    [enabledLines],
  );

  const bodyKey = `${pending?.id ?? 'none'}:${firstChestId ?? 'no-chest'}:${enabledLinesKey}`;

  if (!pending) {
    return (
      <AppModal
        opened={false}
        onClose={onClose}
        title={isIncoming ? 'Terminer — ajouter au stock' : 'Terminer — retirer du stock'}
        size="xl"
      >
        {null}
      </AppModal>
    );
  }

  return (
    <CompleteOrderStockBody
      key={bodyKey}
      opened={opened}
      dispensarySlug={dispensarySlug}
      isIncoming={isIncoming}
      pending={pending}
      enabledLines={enabledLines}
      firstChestId={firstChestId}
      chestOptions={chestOptions}
      onClose={onClose}
      onCompleted={onCompleted}
    />
  );
}
