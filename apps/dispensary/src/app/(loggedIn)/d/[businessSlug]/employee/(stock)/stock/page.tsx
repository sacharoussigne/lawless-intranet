import { getItemsWithStock, getLastStockDaysByChest } from '@/app/_actions/stock';
import { getChestsList } from '@/app/_actions/chests';
import { getStockChecksSummary } from '@/app/_actions/stockChecks';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { getMyStockUiPreferences } from '@/app/_actions/stockUiPreferences';
import { BusinessStockWorkspace } from './BusinessStockWorkspace';

async function StockContent({ businessSlug }: { businessSlug: string }) {
  const [chestsResult, stockUiPreferencesResult, stockChecksSummaryResult, lastStockDaysResult] =
    await Promise.all([
      getChestsList(businessSlug, true),
      getMyStockUiPreferences(),
      getStockChecksSummary(businessSlug),
      getLastStockDaysByChest(businessSlug),
    ]);

  const chests = getDataOrThrow(chestsResult, 'Erreur lors du chargement des coffres');
  const stockUiPreferences = getDataOrThrow(
    stockUiPreferencesResult,
    'Erreur lors du chargement des préférences',
  );
  const stockChecksSummary = getDataOrThrow(
    stockChecksSummaryResult,
    'Erreur lors du chargement des contrôles stock',
  );
  const lastStockDaysByChest = getDataOrThrow(
    lastStockDaysResult,
    'Erreur lors du chargement des dates de dernier stock',
  );

  const initialChestId = chests.length === 1 ? chests[0].id : null;
  const itemsResult = await getItemsWithStock(businessSlug, initialChestId);
  const items = getDataOrThrow(itemsResult, 'Erreur lors du chargement du stock');

  return (
    <BusinessStockWorkspace
      businessSlug={businessSlug}
      initialItems={items}
      initialChests={chests}
      initialStockChecksSummary={stockChecksSummary}
      stockUiPreferences={stockUiPreferences}
      initialLastStockDaysByChest={lastStockDaysByChest}
    />
  );
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  return (
    <SuspenseLoader>
      <StockContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
