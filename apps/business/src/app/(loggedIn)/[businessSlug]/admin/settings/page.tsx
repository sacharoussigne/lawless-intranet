import { redirect } from 'next/navigation';
import { getAppSettingsForAdmin } from '@/app/_actions/appSettings';
import { listBusinessMembers } from '@/app/_actions/businessMembers';
import { getBusinessRolePermissionsMatrix } from '@/app/_actions/businessPermissions';
import { listPayrollSalaryTypesForAdmin } from '@/app/_actions/payrollSalaryTypes';
import { routes } from '@/types/routes';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import BusinessSettingsPageClient from './BusinessSettingsPageClient';
import { isBusinessSettingsTab, type BusinessSettingsTab } from './settingsTabs';
import type { BusinessMemberRow } from './BusinessMembersPanel';
import type { RolePermissionsMatrixData } from './BusinessPermissionsPanel';
import {
  applicationPermissionCatalog,
} from '@lawless-intranet/auth-permissions';

const emptyPermissions: RolePermissionsMatrixData = {
  catalog: applicationPermissionCatalog,
  byRole: {},
};

async function SettingsContent({
  businessSlug,
  initialTab,
}: {
  businessSlug: string;
  initialTab: BusinessSettingsTab;
}) {
  const [settingsResult, membersResult, permissionsResult, salaryTypesResult] = await Promise.all([
    getAppSettingsForAdmin(businessSlug),
    listBusinessMembers(businessSlug),
    getBusinessRolePermissionsMatrix(businessSlug),
    listPayrollSalaryTypesForAdmin(businessSlug),
  ]);

  if (settingsResult.status === 401) {
    redirect(routes.auth.login);
  }
  if (settingsResult.status === 403 || settingsResult.status !== 200 || !('data' in settingsResult)) {
    redirect(routes.auth.noManagementAccess);
  }

  return (
    <BusinessSettingsPageClient
      businessSlug={businessSlug}
      initialTab={initialTab}
      initialSettings={settingsResult.data}
      initialMembers={
        membersResult.status === 200
          ? ((membersResult.data ?? []) as BusinessMemberRow[])
          : []
      }
      membersError={
        membersResult.status !== 200 ? membersResult.error : undefined
      }
      initialPermissions={
        permissionsResult.status === 200 && permissionsResult.data
          ? permissionsResult.data
          : emptyPermissions
      }
      permissionsError={
        permissionsResult.status !== 200 ? permissionsResult.error : undefined
      }
      initialSalaryTypes={
        salaryTypesResult.status === 200 && 'data' in salaryTypesResult && salaryTypesResult.data
          ? salaryTypesResult.data
          : []
      }
      salaryTypesError={
        salaryTypesResult.status !== 200 && 'error' in salaryTypesResult
          ? String(salaryTypesResult.error)
          : undefined
      }
    />
  );
}

export default async function AdminAppSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { businessSlug } = await params;
  const { tab } = await searchParams;
  const initialTab: BusinessSettingsTab = tab && isBusinessSettingsTab(tab) ? tab : 'general';

  return (
    <SuspenseLoader>
      <SettingsContent businessSlug={businessSlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
