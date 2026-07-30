'use client';

import { memo, useMemo } from 'react';
import { ActionIcon, Badge, Group, Paper, Table, Text, Tooltip } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import type { CategoryWithItems } from '@/types/stock';
import { getStockPreviousColumnLabel } from '@/lib/stock/stockPreviousLabel';
import { getEffectiveStockQuantity } from '@/lib/stock/ensureTodayStock';
import { sumItemsWeightKg } from '@/lib/stock/stockVisibility';
import { StockRow } from './StockRow';
import type { StockUiPreferences } from '@/types/stockUiPreferences';

interface CategorySectionProps {
  categoryData: CategoryWithItems;
  editedQuantitiesByItemId: Record<string, number | null | undefined>;
  isEditing: boolean;
  isCategoryHidden: boolean;
  showHiddenItemsInPlace: boolean;
  isItemHidden: (itemId: string) => boolean;
  canStockUpdate: boolean;
  canHide: boolean;
  canUnhide: boolean;
  selectedChestId: string | null;
  isCategoryCheckEnabled: (categoryId: string) => boolean;
  getTextColor: (backgroundColor: string) => string;
  stockUiPreferences: StockUiPreferences;
  onCommitQuantity: (itemId: string, quantity: number | null) => void;
  onHideCategory?: (categoryId: string) => void;
  onShowCategory?: (categoryId: string) => void;
  onHideItem?: (itemId: string) => void;
  onShowItem?: (itemId: string) => void;
}

export const CategorySection = memo(function CategorySection({
  categoryData,
  editedQuantitiesByItemId,
  isEditing,
  isCategoryHidden,
  showHiddenItemsInPlace,
  isItemHidden,
  canStockUpdate,
  canHide,
  canUnhide,
  selectedChestId,
  isCategoryCheckEnabled,
  getTextColor,
  stockUiPreferences,
  onCommitQuantity,
  onHideCategory,
  onShowCategory,
  onHideItem,
  onShowItem,
}: CategorySectionProps) {
  const textColor = getTextColor(categoryData.category.color);
  const shouldShowMinimalQuantity = !(selectedChestId !== null && !isCategoryCheckEnabled(categoryData.category.id));

  const rows = useMemo(() => {
    if (isCategoryHidden) return [];
    return categoryData.items.filter((item) => {
      const hidden = isItemHidden(item.id);
      if (!hidden) return true;
      return showHiddenItemsInPlace;
    });
  }, [categoryData.items, isCategoryHidden, isItemHidden, showHiddenItemsInPlace]);

  const visibleItemsForWeight = categoryData.items.filter((item) => !isItemHidden(item.id));
  const categoryTotalWeight = sumItemsWeightKg(visibleItemsForWeight, getEffectiveStockQuantity);

  const previousStockColumnLabel = getStockPreviousColumnLabel(
    rows.map((item) => item.stockPreviousAt),
  );

  return (
    <Paper
      key={categoryData.category.id}
      shadow="sm"
      p="md"
      withBorder
      style={{ opacity: isCategoryHidden ? 0.55 : undefined }}
    >
      <Group mb={isCategoryHidden ? 0 : 'md'} justify="space-between" align="center">
        <Group gap="xs" align="center">
          {canHide && !isCategoryHidden && onHideCategory && (
            <Tooltip label="Masquer cette catégorie sur ce coffre">
              <ActionIcon
                variant="subtle"
                color="slate"
                size="sm"
                aria-label={`Masquer ${categoryData.category.name}`}
                onClick={() => onHideCategory(categoryData.category.id)}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {canUnhide && isCategoryHidden && onShowCategory && (
            <Tooltip label="Réafficher cette catégorie">
              <ActionIcon
                variant="subtle"
                color="slate"
                size="sm"
                aria-label={`Réafficher ${categoryData.category.name}`}
                onClick={() => onShowCategory(categoryData.category.id)}
              >
                <IconEyeOff size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Badge
            style={{
              backgroundColor: categoryData.category.color,
              color: textColor,
            }}
            variant="filled"
            size="lg"
          >
            {categoryData.category.name}
          </Badge>
          <Text c="dimmed" size="sm" className="disp-inline-meta">
            {isCategoryHidden
              ? `${categoryData.items.length} objet(s) · masquée`
              : `${rows.filter((item) => !isItemHidden(item.id)).length} objet(s)`}
          </Text>
        </Group>
        {!isCategoryHidden && categoryTotalWeight > 0 && (
          <Text size="sm" fw={600} c={categoryData.category.color} className="disp-inline-meta">
            {categoryTotalWeight.toFixed(2)} kg
          </Text>
        )}
      </Group>

      {!isCategoryHidden && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nom</Table.Th>
              <Table.Th>
                {shouldShowMinimalQuantity ? (
                  'Quantité minimale'
                ) : (
                  <span style={{ visibility: 'hidden' }}>Quantité minimale</span>
                )}
              </Table.Th>
              <Table.Th>{previousStockColumnLabel}</Table.Th>
              <Table.Th>Stock aujourd'hui</Table.Th>
              {isEditing && canStockUpdate && <Table.Th>Nouveau stock</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((item) => {
              const itemHidden = isItemHidden(item.id);
              return (
                <StockRow
                  key={item.id}
                  item={item}
                  editedQuantity={editedQuantitiesByItemId[item.id] ?? item.stockToday}
                  isEditing={isEditing}
                  isHidden={itemHidden}
                  canStockUpdate={canStockUpdate}
                  canHide={canHide && !itemHidden}
                  canUnhide={canUnhide && itemHidden}
                  isCategoryCheckEnabled={isCategoryCheckEnabled}
                  shouldShowMinimalQuantity={shouldShowMinimalQuantity}
                  getTextColor={getTextColor}
                  stockUiPreferences={stockUiPreferences}
                  onCommitQuantity={onCommitQuantity}
                  onHideItem={onHideItem}
                  onShowItem={onShowItem}
                />
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
});
