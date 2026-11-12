import { getItems } from '@/app/_actions/items';
import SearchItemsPageClient from './SearchItemsPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function SearchItemsContent({ businessSlug, itemId }: { businessSlug: string; itemId: string | null }) {
  const itemsResult = await getItems(businessSlug);
  const items = getDataOrThrow(itemsResult, 'Erreur lors du chargement des items');
  // `?item=` (command palette): opens on that item.
  const initialSelected = itemId && items.some((item) => item.id === itemId) ? [itemId] : [];

  return <SearchItemsPageClient key={itemId ?? ''} initialItems={items} initialSelectedItemIds={initialSelected} />;
}

export default async function SearchItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ item?: string | string[] }>;
}) {
  const { businessSlug } = await params;
  const { item } = await searchParams;
  return (
    <SuspenseLoader>
      <SearchItemsContent businessSlug={businessSlug} itemId={typeof item === 'string' && item ? item : null} />
    </SuspenseLoader>
  );
}
