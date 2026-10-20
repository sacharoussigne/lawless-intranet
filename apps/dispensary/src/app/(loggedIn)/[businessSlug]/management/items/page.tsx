import { getItems } from '@/app/_actions/items';
import { getManagementCategoryItems } from '@/app/_actions/categoryItems';
import { getCompanyGroupsForSelect } from '@/app/_actions/companyGroups';
import ItemsManagementPageClient from './ItemsManagementPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function ItemsContent({
  businessSlug,
  initialTab,
}: {
  businessSlug: string;
  initialTab: 'items' | 'categories';
}) {
  const [itemsResult, categoryItemsResult, companyGroupsResult] = await Promise.all([
    getItems(businessSlug),
    getManagementCategoryItems(businessSlug),
    getCompanyGroupsForSelect(businessSlug),
  ]);

  const items = getDataOrThrow(itemsResult, 'Erreur lors du chargement des objets');
  const categoryItems = getDataOrThrow(categoryItemsResult, 'Erreur lors du chargement des catégories');
  const companyGroups = getDataOrThrow(companyGroupsResult, 'Erreur lors du chargement des groupes d\'entreprises');

  return (
    <ItemsManagementPageClient
      initialTab={initialTab}
      initialItems={items}
      initialCategoryItems={categoryItems}
      initialCompanyGroups={companyGroups}
    />
  );
}

export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { businessSlug } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === 'categories' ? 'categories' : 'items';

  return (
    <SuspenseLoader>
      <ItemsContent businessSlug={businessSlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
