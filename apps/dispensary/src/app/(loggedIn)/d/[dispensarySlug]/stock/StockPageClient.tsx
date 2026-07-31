'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Container, Text, Stack, Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import CraftModal from './modals/CraftModal';
import TransferModal from './modals/TransferModal';
import TakeDepositModal from './modals/TakeModal';
import type { ItemWithRelations } from '@/types/stock';
import { usePermissions, useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import type { ChestListItem } from '@/types/chests';
import { StockHeader } from './components/StockHeader';
import { ChestSelectorBar } from './components/ChestSelectorBar';
import { CategorySection } from './components/CategorySection';
import { groupItemsByCategory } from '@/lib/stock/sortItemsByCategory';
import { resolveLastStockDayLabel } from '@/lib/stock/stockPreviousLabel';
import { getEffectiveStockQuantity } from '@/lib/stock/ensureTodayStock';
import { getContrastTextColor } from '@/lib/color/contrastTextColor';
import type { StockChecksSummary } from '@/app/_actions/stockChecks';
import type { StockUiPreferences } from '@/types/stockUiPreferences';
import { stockKeys } from '@/lib/stock/queryKeys';
import {
  EMPTY_CHEST_STOCK_VISIBILITY,
  buildManualStockSavePayload,
  isCategoryHidden,
  isStockEntryHidden,
  partitionItemsByVisibility,
  sumItemsWeightKg,
} from '@/lib/stock/stockVisibility';
import {
  useStockItems,
  useStockChecksSummary,
  useLastStockDaysByChest,
  useChestStockVisibility,
  useSetChestCategoryHiddenMutation,
  useSetChestItemHiddenMutation,
  useUpdateStockMutation,
  useCraftMutation,
  getChangedStockEntries,
} from './hooks/useStockQueries';

interface StockPageClientProps {
  initialItems: ItemWithRelations[];
  initialChests: ChestListItem[];
  initialStockChecksSummary: StockChecksSummary;
  stockUiPreferences: StockUiPreferences;
  initialLastStockDaysByChest: Record<string, Date | null>;
}

export default function StockPageClient({
  initialItems,
  initialChests,
  initialStockChecksSummary,
  stockUiPreferences,
  initialLastStockDaysByChest,
}: StockPageClientProps) {
  const { permissions } = usePermissions();
  const dispensarySlug = useRequiredDispensarySlug();
  const queryClient = useQueryClient();
  const chests = initialChests;
  const [selectedChestId, setSelectedChestId] = useState<string | null>(() =>
    initialChests.length === 1 ? initialChests[0].id : null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [craftModalOpened, setCraftModalOpened] = useState(false);
  const [transferModalOpened, setTransferModalOpened] = useState(false);
  const [takeModalOpened, setTakeModalOpened] = useState(false);
  const [editedQuantitiesByItemId, setEditedQuantitiesByItemId] = useState<Record<string, number | null>>({});
  const [skipHistory, setSkipHistory] = useState(false);
  const [isManagingVisibility, setIsManagingVisibility] = useState(false);

  const canStockUpdate = Boolean(permissions?.stock.update);
  const canStockHide = Boolean(permissions?.stock.hide);
  const canTakeDeposit = chests.length > 0;
  const canManageVisibility = Boolean(selectedChestId && !isEditing && canStockHide);
  const canToggleVisibility = Boolean(canManageVisibility && isManagingVisibility);

  const ssrItemsChestId = initialChests.length === 1 ? initialChests[0].id : null;
  const stockItemsInitialData =
    selectedChestId === ssrItemsChestId && initialItems.length > 0 ? initialItems : undefined;

  // Overwrite empty poisoned cache before useQuery reads it (same render).
  if (stockItemsInitialData) {
    const key = stockKeys.items(dispensarySlug, selectedChestId);
    const cached = queryClient.getQueryData<ItemWithRelations[]>(key);
    if (!cached || cached.length === 0) {
      queryClient.setQueryData(key, stockItemsInitialData);
    }
  }

  const { data: items = initialItems, isFetching, isPending } = useStockItems(
    selectedChestId,
    stockItemsInitialData,
  );
  const { data: stockChecksSummary = initialStockChecksSummary } = useStockChecksSummary(initialStockChecksSummary);
  const { data: lastStockDaysByChest = initialLastStockDaysByChest } = useLastStockDaysByChest(initialLastStockDaysByChest);
  const { data: visibility = EMPTY_CHEST_STOCK_VISIBILITY } = useChestStockVisibility(selectedChestId);
  const updateStockMutation = useUpdateStockMutation();
  const craftMutation = useCraftMutation();
  const setCategoryHiddenMutation = useSetChestCategoryHiddenMutation();
  const setItemHiddenMutation = useSetChestItemHiddenMutation();

  const loading = isPending || isFetching;

  const activeVisibility = selectedChestId ? visibility : EMPTY_CHEST_STOCK_VISIBILITY;

  const { visibleItems, hiddenItems } = useMemo(
    () => (selectedChestId ? partitionItemsByVisibility(items, activeVisibility) : { visibleItems: items, hiddenItems: [] }),
    [items, selectedChestId, activeVisibility],
  );

  const showHiddenInPlace = Boolean(selectedChestId && (isEditing || isManagingVisibility));

  const displayCategories = useMemo(() => {
    if (!selectedChestId) {
      return groupItemsByCategory(items);
    }
    if (showHiddenInPlace) {
      return groupItemsByCategory(items);
    }
    return groupItemsByCategory(visibleItems);
  }, [selectedChestId, showHiddenInPlace, items, visibleItems]);

  const seedEditedQuantity = useCallback((item: ItemWithRelations) => {
    setEditedQuantitiesByItemId((prev) => {
      if (item.id in prev) return prev;
      return {
        ...prev,
        [item.id]: item.stockToday !== null ? item.stockToday : null,
      };
    });
  }, []);

  const handleStartEdit = () => {
    setIsManagingVisibility(false);
    const initialValues: Record<string, number | null> = {};
    visibleItems.forEach((item) => {
      initialValues[item.id] = item.stockToday !== null ? item.stockToday : null;
    });
    setEditedQuantitiesByItemId(initialValues);
    setIsEditing(true);
  };

  const handleChangeChestId = useCallback((chestId: string | null) => {
    setIsManagingVisibility(false);
    setSelectedChestId(chestId);
  }, []);

  const handleSaveStock = async () => {
    const stockData = buildManualStockSavePayload(
      visibleItems,
      hiddenItems,
      editedQuantitiesByItemId,
      getChangedStockEntries,
    );

    if (stockData.length === 0) {
      notifications.show({
        title: 'Avertissement',
        message: 'Aucune modification de stock à sauvegarder',
        color: 'amber',
      });
      return;
    }

    const targetChestId = selectedChestId || null;
    const chestName = targetChestId
      ? chests.find((c) => c.id === targetChestId)?.name || 'le coffre sélectionné'
      : 'Foure tout';

    try {
      await updateStockMutation.mutateAsync({
        stockData,
        targetChestId,
        skipHistory,
        chestName,
      });
      setIsEditing(false);
      setEditedQuantitiesByItemId({});
      setSkipHistory(false);
    } catch {
      // Notification handled in mutation hook
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedQuantitiesByItemId({});
    setSkipHistory(false);
  };

  const handleCommitQuantity = useCallback((itemId: string, quantity: number | null) => {
    setEditedQuantitiesByItemId((prev) => ({
      ...prev,
      [itemId]: quantity,
    }));
  }, []);

  const getTextColor = useCallback(
    (backgroundColor: string) => getContrastTextColor(backgroundColor),
    [],
  );

  const handleHideCategory = useCallback(
    (categoryId: string) => {
      if (!selectedChestId) return;
      setCategoryHiddenMutation.mutate({ chestId: selectedChestId, categoryId, hidden: true });
    },
    [selectedChestId, setCategoryHiddenMutation],
  );

  const handleShowCategory = useCallback(
    (categoryId: string) => {
      if (!selectedChestId) return;
      if (isEditing) {
        items
          .filter((item) => item.categoryId === categoryId)
          .forEach((item) => seedEditedQuantity(item));
      }
      setCategoryHiddenMutation.mutate({ chestId: selectedChestId, categoryId, hidden: false });
    },
    [selectedChestId, isEditing, items, seedEditedQuantity, setCategoryHiddenMutation],
  );

  const handleHideItem = useCallback(
    (itemId: string) => {
      if (!selectedChestId) return;
      setItemHiddenMutation.mutate({ chestId: selectedChestId, itemId, hidden: true });
    },
    [selectedChestId, setItemHiddenMutation],
  );

  const handleShowItem = useCallback(
    (itemId: string) => {
      if (!selectedChestId) return;
      if (isEditing) {
        const item = items.find((entry) => entry.id === itemId);
        if (item) seedEditedQuantity(item);
      }
      setItemHiddenMutation.mutate({ chestId: selectedChestId, itemId, hidden: false });
    },
    [selectedChestId, isEditing, items, seedEditedQuantity, setItemHiddenMutation],
  );

  const isItemHiddenForDisplay = useCallback(
    (itemId: string) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item) return false;
      return isStockEntryHidden(item, activeVisibility);
    },
    [items, activeVisibility],
  );

  const isCategoryCheckEnabled = useCallback((categoryId: string): boolean => {
    if (!stockChecksSummary) return true;

    const isEnabledForChest = (chestId: string): boolean => {
      const cfg = stockChecksSummary.configsByChestId[chestId];
      if (!cfg) return true;
      return cfg.isEnabled;
    };

    const isCategoryEnabledForChest = (chestId: string): boolean => {
      const cfg = stockChecksSummary.configsByChestId[chestId];
      if (!cfg) return true;
      if (!cfg.isEnabled) return false;
      if (cfg.categoryIds.length === 0) return true;
      return cfg.categoryIds.includes(categoryId);
    };

    if (selectedChestId) {
      if (!isEnabledForChest(selectedChestId)) return false;
      return isCategoryEnabledForChest(selectedChestId);
    }

    return stockChecksSummary.enabledChestIds.some((chestId) => isCategoryEnabledForChest(chestId));
  }, [selectedChestId, stockChecksSummary]);

  const { itemsWithStockToday, totalWeightToday } = useMemo(() => {
    const withStock = visibleItems.filter((item) => item.stockToday !== null).length;

    return {
      itemsWithStockToday: withStock,
      totalWeightToday: sumItemsWeightKg(visibleItems, getEffectiveStockQuantity),
    };
  }, [visibleItems]);

  const lastStockLabel = useMemo(() => {
    if (itemsWithStockToday > 0) return null;

    const dates = selectedChestId
      ? [lastStockDaysByChest[selectedChestId]]
      : chests.map((chest) => lastStockDaysByChest[chest.id]);

    const label = resolveLastStockDayLabel(dates, 'newest');
    return label ? `Dernier stock : ${label}` : null;
  }, [itemsWithStockToday, selectedChestId, chests, lastStockDaysByChest]);

  const chestOptions = useMemo(() => {
    const options = chests.map((chest) => ({
      value: chest.id,
      label: chest.name,
    }));
    if (chests.length <= 1) return options;
    return [{ value: '', label: 'Tous les coffres' }, ...options];
  }, [chests]);

  if (chests.length === 0) {
    return (
      <Container size="xl" py="xl">
        <StockHeader
          isEditing={false}
          canCraftReadOrWrite={false}
          canTakeDeposit={false}
          canTransfer={false}
          onOpenCraft={() => undefined}
          onOpenTransfer={() => undefined}
          onOpenTake={() => undefined}
        />
        <Text c="dimmed">
          Aucun coffre accessible avec votre rôle. Demandez à un administrateur de configurer
          l&apos;accès aux coffres.
        </Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <StockHeader
        isEditing={isEditing}
        canCraftReadOrWrite={Boolean(permissions?.stock.craftRead || permissions?.stock.craftWrite)}
        canTakeDeposit={canTakeDeposit}
        canTransfer={canStockUpdate}
        onOpenCraft={() => setCraftModalOpened(true)}
        onOpenTransfer={() => setTransferModalOpened(true)}
        onOpenTake={() => setTakeModalOpened(true)}
      />

      <ChestSelectorBar
        chestOptions={chestOptions}
        selectedChestId={selectedChestId}
        isEditing={isEditing}
        saving={updateStockMutation.isPending}
        skipHistory={skipHistory}
        totalWeightToday={totalWeightToday}
        itemsWithStockToday={itemsWithStockToday}
        lastStockLabel={lastStockLabel}
        canStockUpdate={canStockUpdate}
        canManageVisibility={canManageVisibility}
        isManagingVisibility={isManagingVisibility}
        chestSelectLocked={chests.length === 1}
        onChangeChestId={handleChangeChestId}
        onToggleManagingVisibility={() => setIsManagingVisibility((prev) => !prev)}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSave={handleSaveStock}
        onSkipHistoryChange={setSkipHistory}
      />

      {loading ? (
        <Center py="xl" mih={240}>
          <Stack align="center" gap="md">
            <Loader color="sage" type="dots" size="lg" />
            <Text size="sm" c="dimmed">
              Chargement du stock…
            </Text>
          </Stack>
        </Center>
      ) : displayCategories.length === 0 ? (
        <Text c="dimmed">Aucun objet trouvé</Text>
      ) : (
        <Stack gap="xl">
          {displayCategories.map((categoryData) => {
            const categoryHidden = isCategoryHidden(categoryData.category.id, activeVisibility);
            return (
              <CategorySection
                key={categoryData.category.id}
                categoryData={categoryData}
                editedQuantitiesByItemId={editedQuantitiesByItemId}
                isEditing={isEditing}
                isCategoryHidden={categoryHidden}
                showHiddenItemsInPlace={showHiddenInPlace}
                isItemHidden={isItemHiddenForDisplay}
                canStockUpdate={canStockUpdate}
                canHide={canToggleVisibility}
                canUnhide={canToggleVisibility || (isEditing && canStockUpdate && Boolean(selectedChestId))}
                selectedChestId={selectedChestId}
                isCategoryCheckEnabled={isCategoryCheckEnabled}
                getTextColor={getTextColor}
                stockUiPreferences={stockUiPreferences}
                onCommitQuantity={handleCommitQuantity}
                onHideCategory={handleHideCategory}
                onShowCategory={handleShowCategory}
                onHideItem={handleHideItem}
                onShowItem={handleShowItem}
              />
            );
          })}
        </Stack>
      )}

      <CraftModal
        opened={craftModalOpened}
        onClose={() => setCraftModalOpened(false)}
        canCraft={permissions?.stock.craftWrite ?? false}
        initialChestId={selectedChestId}
        chests={chests}
        onCraft={async (itemId, recipeId, times, sourceChestId, ingredientChests, destinationChestId) => {
            if (!permissions?.stock.craftWrite) {
              notifications.show({
                title: 'Permission refusée',
                message: 'Vous n\'avez pas la permission d\'effectuer un craft.',
                color: 'danger',
              });
              return { ok: false as const };
            }
            try {
              const affectedChestIds = [
                sourceChestId,
                destinationChestId,
                ...ingredientChests.map((ic) => ic.chestId),
              ];
              const result = await craftMutation.mutateAsync({
                itemId,
                recipeId,
                times,
                sourceChestId,
                ingredientChests,
                destinationChestId,
                affectedChestIds,
              });
              notifications.show({
                title: 'Succès',
                message: `Craft effectué avec succès ! ${result.quantityProduced} objet(s) produit(s).`,
                color: 'moss',
              });
              return { ok: true as const, quantityProduced: result.quantityProduced as number };
            } catch (error) {
              notifications.show({
                title: 'Erreur',
                message: error instanceof Error ? error.message : 'Erreur lors du craft',
                color: 'danger',
              });
              return { ok: false as const };
            }
          }}
      />

      <TransferModal
        opened={transferModalOpened}
        onClose={() => setTransferModalOpened(false)}
        chests={chests}
        initialSourceChestId={selectedChestId}
      />

      <TakeDepositModal
        opened={takeModalOpened}
        onClose={() => setTakeModalOpened(false)}
        chests={chests}
        initialChestId={selectedChestId}
      />
    </Container>
  );
}
