import { redirect } from 'next/navigation';
import { getAppSettingsForAdmin } from '@/app/_actions/appSettings';
import { listDispensaryMembers } from '@/app/_actions/dispensaryMembers';
import { routes } from '@/types/routes';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import DispensarySettingsPageClient, {
  type DispensarySettingsTab,
} from './DispensarySettingsPageClient';
import type { DispensaryMemberRow } from './DispensaryMembersPanel';

async function SettingsContent({
  dispensarySlug,
  initialTab,
}: {
  dispensarySlug: string;
  initialTab: DispensarySettingsTab;
}) {
  const [settingsResult, membersResult] = await Promise.all([
    getAppSettingsForAdmin(dispensarySlug),
    listDispensaryMembers(dispensarySlug),
  ]);

  if (settingsResult.status === 401) {
    redirect(routes.auth.login);
  }
  if (settingsResult.status === 403 || settingsResult.status !== 200 || !('data' in settingsResult)) {
    redirect(routes.auth.noManagementAccess);
  }

  return (
    <DispensarySettingsPageClient
      dispensarySlug={dispensarySlug}
      initialTab={initialTab}
      initialSettings={settingsResult.data}
      initialMembers={
        membersResult.status === 200
          ? ((membersResult.data ?? []) as DispensaryMemberRow[])
          : []
      }
      membersError={
        membersResult.status !== 200 ? membersResult.error : undefined
      }
    />
  );
}

export default async function AdminAppSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { dispensarySlug } = await params;
  const { tab } = await searchParams;
  const initialTab: DispensarySettingsTab = tab === 'members' ? 'members' : 'general';

  return (
    <SuspenseLoader>
      <SettingsContent dispensarySlug={dispensarySlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
