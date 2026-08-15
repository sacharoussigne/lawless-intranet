'use client';

import { Tabs } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { Container } from '@mantine/core';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { ShelterSettingsGeneralPanel } from './ShelterSettingsGeneralPanel';
import { ShelterMembersPanel, type ShelterMemberRow } from './ShelterMembersPanel';
import {
  ShelterPermissionsPanel,
  type RolePermissionsMatrixData,
} from './ShelterPermissionsPanel';
import type { ShelterSettingsAdminDTO } from '@/app/_actions/shelterSettings';
import { tenantRoutes } from '@/types/routes';

export type ShelterSettingsTab = 'general' | 'members' | 'permissions';

export default function ShelterSettingsPageClient({
  shelterSlug,
  initialTab,
  initialSettings,
  initialMembers,
  membersError,
  initialPermissions,
  permissionsError,
}: {
  shelterSlug: string;
  initialTab: ShelterSettingsTab;
  initialSettings: ShelterSettingsAdminDTO;
  initialMembers: ShelterMemberRow[];
  membersError?: string;
  initialPermissions: RolePermissionsMatrixData;
  permissionsError?: string;
}) {
  const router = useRouter();

  return (
    <Container size="xl">
      <PageHeader
        title="Paramètres du refuge"
        description="Général, membres et permissions."
      />
      <Tabs
        value={initialTab}
        onChange={(value) => {
          if (!value) return;
          const href = `${tenantRoutes(shelterSlug).admin.settings}?tab=${value}`;
          router.push(href);
        }}
      >
        <Tabs.List mb="md">
          <Tabs.Tab value="general">Général</Tabs.Tab>
          <Tabs.Tab value="members">Membres</Tabs.Tab>
          <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general">
          <ShelterSettingsGeneralPanel shelterSlug={shelterSlug} initial={initialSettings} />
        </Tabs.Panel>
        <Tabs.Panel value="members">
          <ShelterMembersPanel
            shelterSlug={shelterSlug}
            initialMembers={initialMembers}
            error={membersError}
          />
        </Tabs.Panel>
        <Tabs.Panel value="permissions">
          {permissionsError ? (
            <p>{permissionsError}</p>
          ) : (
            <ShelterPermissionsPanel shelterSlug={shelterSlug} initial={initialPermissions} />
          )}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
