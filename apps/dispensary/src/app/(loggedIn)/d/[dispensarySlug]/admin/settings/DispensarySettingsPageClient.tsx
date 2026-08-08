'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Container, Tabs } from '@mantine/core';
import { IconAdjustments, IconUsers } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import type { DispensarySettingsAdminDTO } from '@/app/_actions/appSettings';
import { AppSettingsGeneralPanel } from './AppSettingsGeneralPanel';
import { DispensaryMembersPanel, type DispensaryMemberRow } from './DispensaryMembersPanel';

const validTabs = ['general', 'members'] as const;
export type DispensarySettingsTab = (typeof validTabs)[number];

type DispensarySettingsPageClientProps = {
  dispensarySlug: string;
  initialTab: DispensarySettingsTab;
  initialSettings: DispensarySettingsAdminDTO;
  initialMembers: DispensaryMemberRow[];
  membersError?: string;
};

export default function DispensarySettingsPageClient({
  dispensarySlug,
  initialTab,
  initialSettings,
  initialMembers,
  membersError,
}: DispensarySettingsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabFromUrl = searchParams.get('tab');
  const resolvedTab: DispensarySettingsTab =
    tabFromUrl && validTabs.includes(tabFromUrl as DispensarySettingsTab)
      ? (tabFromUrl as DispensarySettingsTab)
      : initialTab;
  const [activeTab, setActiveTab] = useState<DispensarySettingsTab>(resolvedTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab as DispensarySettingsTab)) {
      setActiveTab(tab as DispensarySettingsTab);
    } else if (!tab) {
      setActiveTab('general');
    }
  }, [searchParams]);

  const handleTabChange = (value: string | null) => {
    if (!value || !validTabs.includes(value as DispensarySettingsTab)) return;
    const tab = value as DispensarySettingsTab;
    setActiveTab(tab);
    if (tab === 'general') {
      router.push(pathname, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Container size="xl" py="xl" w="100%">
      <PageHeader
        title="Paramètres du dispensaire"
        description="Identité, modules employés et gestion de l’équipe."
      />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="general" leftSection={<IconAdjustments size={16} />}>
            Général
          </Tabs.Tab>
          <Tabs.Tab value="members" leftSection={<IconUsers size={16} />}>
            Membres
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="xl">
          <AppSettingsGeneralPanel dispensarySlug={dispensarySlug} initial={initialSettings} />
        </Tabs.Panel>

        <Tabs.Panel value="members" pt="xl">
          <DispensaryMembersPanel
            dispensarySlug={dispensarySlug}
            initialMembers={initialMembers}
            error={membersError}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
