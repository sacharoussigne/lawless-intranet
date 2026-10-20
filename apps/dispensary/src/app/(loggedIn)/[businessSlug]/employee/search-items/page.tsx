import { getItems } from '@/app/_actions/items';
import SearchItemsPageClient from './SearchItemsPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function SearchItemsContent({ businessSlug }: { businessSlug: string }) {
  const itemsResult = await getItems(businessSlug);
  const items = getDataOrThrow(itemsResult, 'Erreur lors du chargement des items');

  return <SearchItemsPageClient initialItems={items} />;
}

export default async function SearchItemsPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  return (
    <SuspenseLoader>
      <SearchItemsContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
