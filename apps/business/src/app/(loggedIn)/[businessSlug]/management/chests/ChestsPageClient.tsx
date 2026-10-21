'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Container, Tabs } from '@mantine/core';
import { IconBox, IconLockAccess } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { ChestsTabPanel } from './components/ChestsTabPanel';
import { ChestAccessTabPanel } from './components/ChestAccessTabPanel';
import type { ChestWithStockHistory } from '@/types/chests';
import type { RoleChestAccessRow } from '@/app/_actions/chestAccess';

const validTabs = ['chests', 'access'] as const;
type ChestsManagementTab = (typeof validTabs)[number];

interface ChestsPageClientProps {
  initialTab: ChestsManagementTab;
  initialChests: ChestWithStockHistory[];
  initialAccesses: RoleChestAccessRow[];
}

export default function ChestsPageClient({
  initialTab,
  initialChests,
  initialAccesses,
}: ChestsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabFromUrl = searchParams.get('tab');
  const resolvedTab: ChestsManagementTab =
    tabFromUrl && validTabs.includes(tabFromUrl as ChestsManagementTab)
      ? (tabFromUrl as ChestsManagementTab)
      : initialTab;
  const [activeTab, setActiveTab] = useState<ChestsManagementTab>(resolvedTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab as ChestsManagementTab)) {
      setActiveTab(tab as ChestsManagementTab);
    } else if (!tab) {
      setActiveTab('chests');
    }
  }, [searchParams]);

  const handleTabChange = (value: string | null) => {
    if (!value || !validTabs.includes(value as ChestsManagementTab)) return;
    const tab = value as ChestsManagementTab;
    setActiveTab(tab);
    if (tab === 'chests') {
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
        title="Coffres"
        description="Gestion des coffres de stock, vérifications et accès par rôle."
      />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="chests" leftSection={<IconBox size={16} />}>
            Coffres
          </Tabs.Tab>
          <Tabs.Tab value="access" leftSection={<IconLockAccess size={16} />}>
            Accès par rôle
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="chests" pt="xl">
          <ChestsTabPanel initialChests={initialChests} />
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="xl">
          <ChestAccessTabPanel
            initialChests={initialChests}
            initialAccesses={initialAccesses}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
