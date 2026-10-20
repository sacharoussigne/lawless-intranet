'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Container, Tabs } from '@mantine/core';
import { IconCategory2, IconLayoutGrid } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { ItemsTabPanel } from './ItemsTabPanel';
import { CategoryItemsTabPanel } from '../categoryitems/CategoryItemsTabPanel';
import type { ItemWithRelations, CompanyGroupSelect } from '@/types/items';
import type { CategoryItemWithCount } from '@/types/categoryItems';

const validTabs = ['items', 'categories'] as const;
type ItemsManagementTab = (typeof validTabs)[number];

interface ItemsManagementPageClientProps {
  initialTab: ItemsManagementTab;
  initialItems: ItemWithRelations[];
  initialCategoryItems: CategoryItemWithCount[];
  initialCompanyGroups: CompanyGroupSelect[];
}

export default function ItemsManagementPageClient({
  initialTab,
  initialItems,
  initialCategoryItems,
  initialCompanyGroups,
}: ItemsManagementPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabFromUrl = searchParams.get('tab');
  const resolvedTab: ItemsManagementTab =
    tabFromUrl && validTabs.includes(tabFromUrl as ItemsManagementTab)
      ? (tabFromUrl as ItemsManagementTab)
      : initialTab;
  const [activeTab, setActiveTab] = useState<ItemsManagementTab>(resolvedTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab as ItemsManagementTab)) {
      setActiveTab(tab as ItemsManagementTab);
    } else if (!tab) {
      setActiveTab('items');
    }
  }, [searchParams]);

  const handleTabChange = (value: string | null) => {
    if (!value || !validTabs.includes(value as ItemsManagementTab)) return;
    const tab = value as ItemsManagementTab;
    setActiveTab(tab);
    if (tab === 'items') {
      router.push(pathname, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Objets"
        description="Catalogue des objets du dispensaire, catégories et paramètres de stock."
      />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="items" leftSection={<IconLayoutGrid size={16} />}>
            Objets
          </Tabs.Tab>
          <Tabs.Tab value="categories" leftSection={<IconCategory2 size={16} />}>
            Catégories
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="items" pt="xl">
          <ItemsTabPanel
            initialItems={initialItems}
            categoryItems={initialCategoryItems}
            companyGroups={initialCompanyGroups}
          />
        </Tabs.Panel>

        <Tabs.Panel value="categories" pt="xl">
          <CategoryItemsTabPanel initialCategoryItems={initialCategoryItems} />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
