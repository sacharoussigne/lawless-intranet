'use client';

import { memo } from 'react';
import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconClipboardCheck, IconEye, IconEyeOff } from '@tabler/icons-react';
import type { ItemWithRelations, StockUiPreferences } from '../../types';
import { apothecaryBooleanPills } from '../../lib/apothecaryPill';
import { EditableStockCell } from './EditableStockCell';

interface StockRowProps {
  item: ItemWithRelations;
  editedQuantity: number | null;
  isEditing: boolean;
  isHidden: boolean;
  canStockUpdate: boolean;
  canHide: boolean;
  canUnhide: boolean;
  isCategoryCheckEnabled: (categoryId: string) => boolean;
  shouldShowMinimalQuantity: boolean;
  getTextColor: (backgroundColor: string) => string;
  stockUiPreferences: StockUiPreferences;
  onCommitQuantity: (itemId: string, quantity: number | null) => void;
  onHideItem?: (itemId: string) => void;
  onShowItem?: (itemId: string) => void;
}

export const StockRow = memo(function StockRow({
  item,
  editedQuantity,
  isEditing,
  isHidden,
  canStockUpdate,
  canHide,
  canUnhide,
  isCategoryCheckEnabled,
  shouldShowMinimalQuantity,
  getTextColor,
  stockUiPreferences,
  onCommitQuantity,
  onHideItem,
  onShowItem,
}: StockRowProps) {
  const hasStockToday = item.stockToday !== null;

  const currentStock =
    item.stockToday !== null ? item.stockToday : item.stockYesterday !== null ? item.stockYesterday : null;

  const shouldCheck = isCategoryCheckEnabled(item.categoryId);
  const isStockLow = !isHidden && shouldCheck && currentStock !== null && currentStock < item.minimalQuantity;

  let backgroundColor: string | undefined = undefined;
  if (!isHidden) {
    if (isStockLow) {
      if (item.isCraftable || item.companyGroupId === null) backgroundColor = stockUiPreferences.lowStockCraftableBg;
      else backgroundColor = stockUiPreferences.lowStockNormalBg;
    } else if (currentStock === null) {
      backgroundColor = stockUiPreferences.unknownStockBg ?? undefined;
    } else if (shouldCheck && currentStock >= item.minimalQuantity) {
      backgroundColor = stockUiPreferences.okStockBg ?? undefined;
    }
  }

  const doneTodayBadgeBg = stockUiPreferences.doneTodayBadgeBg;
  const doneTodayTextColor = doneTodayBadgeBg ? getTextColor(doneTodayBadgeBg) : undefined;
  const canEditQuantity = isEditing && canStockUpdate && !isHidden;

  return (
    <Table.Tr
      key={item.id}
      style={{
        backgroundColor,
        opacity: isHidden ? 0.45 : undefined,
      }}
    >
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          {canHide && onHideItem && (
            <Tooltip label="Masquer cet objet sur ce coffre">
              <ActionIcon
                variant="subtle"
                color="slate"
                size="sm"
                aria-label={`Masquer ${item.name}`}
                onClick={() => onHideItem(item.id)}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUnhide && isHidden && onShowItem && (
            <Tooltip label="Réafficher cet objet">
              <ActionIcon
                variant="subtle"
                color="slate"
                size="sm"
                aria-label={`Réafficher ${item.name}`}
                onClick={() => onShowItem(item.id)}
              >
                <IconEyeOff size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Text fw={500}>{item.name}</Text>
          {hasStockToday && !isHidden && (
            <Tooltip label="Stock déjà fait aujourd'hui">
              {doneTodayBadgeBg ? (
                <Badge
                  variant="filled"
                  size="sm"
                  leftSection={<IconClipboardCheck size={12} />}
                  style={{ backgroundColor: doneTodayBadgeBg, color: doneTodayTextColor }}
                >
                  Fait
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  size="sm"
                  leftSection={<IconClipboardCheck size={12} />}
                  style={apothecaryBooleanPills.yes}
                >
                  Fait
                </Badge>
              )}
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        {shouldShowMinimalQuantity ? (
          item.minimalQuantity
        ) : (
          <span style={{ visibility: 'hidden' }}>{item.minimalQuantity}</span>
        )}
      </Table.Td>
      <Table.Td>
        {item.stockYesterday !== null ? <Text>{item.stockYesterday}</Text> : <Text c="dimmed">?</Text>}
      </Table.Td>
      <Table.Td>
        {item.stockToday !== null ? (
          <Text fw={hasStockToday ? 600 : undefined}>{item.stockToday}</Text>
        ) : (
          <Text c="dimmed">?</Text>
        )}
      </Table.Td>

      {isEditing && canStockUpdate && (
        <Table.Td>
          {canEditQuantity ? (
            <EditableStockCell
              key={`${item.id}:${editedQuantity ?? ''}`}
              item={item}
              hasStockToday={hasStockToday}
              initialValue={editedQuantity}
              onCommitQuantity={onCommitQuantity}
            />
          ) : (
            <Text size="sm" c="dimmed">
              Masqué
            </Text>
          )}
        </Table.Td>
      )}
    </Table.Tr>
  );
});
