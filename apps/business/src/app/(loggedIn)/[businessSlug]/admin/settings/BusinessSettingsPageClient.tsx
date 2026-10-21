'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Container, Tabs } from '@mantine/core';
import { IconAdjustments, IconLock, IconUsers } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import type { BusinessSettingsAdminDTO } from '@/app/_actions/appSettings';
import { AppSettingsGeneralPanel } from './AppSettingsGeneralPanel';
import { BusinessMembersPanel, type BusinessMemberRow } from './BusinessMembersPanel';
import {
  BusinessPermissionsPanel,
  type RolePermissionsMatrixData,
} from './BusinessPermissionsPanel';

const validTabs = ['general', 'members', 'permissions'] as const;
export type BusinessSettingsTab = (typeof validTabs)[number];

type BusinessSettingsPageClientProps = {
  businessSlug: string;
  initialTab: BusinessSettingsTab;
  initialSettings: BusinessSettingsAdminDTO;
  initialMembers: BusinessMemberRow[];
  initialPermissions: RolePermissionsMatrixData;
  membersError?: string;
  permissionsError?: string;
};

export default function BusinessSettingsPageClient({
  businessSlug,
  initialTab,
  initialSettings,
  initialMembers,
  initialPermissions,
  membersError,
  permissionsError,
}: BusinessSettingsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabFromUrl = searchParams.get('tab');
  const resolvedTab: BusinessSettingsTab =
    tabFromUrl && validTabs.includes(tabFromUrl as BusinessSettingsTab)
      ? (tabFromUrl as BusinessSettingsTab)
      : initialTab;
  const [activeTab, setActiveTab] = useState<BusinessSettingsTab>(resolvedTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab as BusinessSettingsTab)) {
      setActiveTab(tab as BusinessSettingsTab);
    } else if (!tab) {
      setActiveTab('general');
    }
  }, [searchParams]);

  const handleTabChange = (value: string | null) => {
    if (!value || !validTabs.includes(value as BusinessSettingsTab)) return;
    const tab = value as BusinessSettingsTab;
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
        description="Identité, modules employés, permissions et gestion de l’équipe."
      />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="general" leftSection={<IconAdjustments size={16} />}>
            Général
          </Tabs.Tab>
          <Tabs.Tab value="members" leftSection={<IconUsers size={16} />}>
            Membres
          </Tabs.Tab>
          <Tabs.Tab value="permissions" leftSection={<IconLock size={16} />}>
            Permissions
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="xl">
          <AppSettingsGeneralPanel businessSlug={businessSlug} initial={initialSettings} />
        </Tabs.Panel>

        <Tabs.Panel value="members" pt="xl">
          <BusinessMembersPanel
            businessSlug={businessSlug}
            initialMembers={initialMembers}
            error={membersError}
          />
        </Tabs.Panel>

        <Tabs.Panel value="permissions" pt="xl">
          {permissionsError ? (
            <p style={{ color: 'var(--disp-danger)' }}>{permissionsError}</p>
          ) : (
            <BusinessPermissionsPanel
              businessSlug={businessSlug}
              initial={initialPermissions}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
