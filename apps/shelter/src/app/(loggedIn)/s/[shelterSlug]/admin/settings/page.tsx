import { redirect } from 'next/navigation';
import { getAppSettingsForAdmin } from '@/app/_actions/shelterSettings';
import { listShelterMembers } from '@/app/_actions/shelterMembers';
import { getShelterRolePermissionsMatrix } from '@/app/_actions/shelterPermissions';
import { routes } from '@/types/routes';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import ShelterSettingsPageClient, {
  type ShelterSettingsTab,
} from './ShelterSettingsPageClient';
import type { ShelterMemberRow } from './ShelterMembersPanel';
import type { RolePermissionsMatrixData } from './ShelterPermissionsPanel';
import { applicationPermissionCatalog } from '@/lib/shelter/permissionsCatalog';

const emptyPermissions: RolePermissionsMatrixData = {
  catalog: applicationPermissionCatalog,
  byRole: {},
};

async function SettingsContent({
  shelterSlug,
  initialTab,
}: {
  shelterSlug: string;
  initialTab: ShelterSettingsTab;
}) {
  const [settingsResult, membersResult, permissionsResult] = await Promise.all([
    getAppSettingsForAdmin(shelterSlug),
    listShelterMembers(shelterSlug),
    getShelterRolePermissionsMatrix(shelterSlug),
  ]);

  if (settingsResult.status === 401) {
    redirect(routes.auth.login);
  }
  if (settingsResult.status === 403 || settingsResult.status !== 200 || !('data' in settingsResult)) {
    redirect(routes.auth.noManagementAccess);
  }

  return (
    <ShelterSettingsPageClient
      shelterSlug={shelterSlug}
      initialTab={initialTab}
      initialSettings={settingsResult.data}
      initialMembers={
        membersResult.status === 200
          ? ((membersResult.data ?? []) as ShelterMemberRow[])
          : []
      }
      membersError={membersResult.status !== 200 ? membersResult.error : undefined}
      initialPermissions={
        permissionsResult.status === 200 && permissionsResult.data
          ? permissionsResult.data
          : emptyPermissions
      }
      permissionsError={
        permissionsResult.status !== 200 ? permissionsResult.error : undefined
      }
    />
  );
}

export default async function AdminAppSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ shelterSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { shelterSlug } = await params;
  const { tab } = await searchParams;
  const initialTab: ShelterSettingsTab =
    tab === 'members' || tab === 'permissions' ? tab : 'general';

  return (
    <SuspenseLoader>
      <SettingsContent shelterSlug={shelterSlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
