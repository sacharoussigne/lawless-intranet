import { getAuthSession } from '@/lib/authSession';
import SettingsPageClient from './SettingsPageClient';
import { getMyStockUiPreferences } from '@/app/_actions/stockUiPreferences';
import { listMyDispensaryGrades } from '@/app/_actions/dispensaryMemberProfile';
import { getDataOrThrow } from '@/lib/response';
import type { UserGender } from '@lawless-intranet/types';

export default async function SettingsPage() {
  const session = await getAuthSession();
  const canChangePassword = Boolean(session?.user?.hasCredentialPassword);

  const stockUiPreferencesResult = await getMyStockUiPreferences();
  const stockUiPreferences = getDataOrThrow(stockUiPreferencesResult, 'Erreur lors du chargement des préférences');
  const gradesResult = await listMyDispensaryGrades();
  const dispensaryGrades =
    gradesResult.status === 200 && 'data' in gradesResult && gradesResult.data
      ? gradesResult.data
      : [];

  return (
    <SettingsPageClient
      initialUser={{
        name: session?.user?.name ?? '',
        image: session?.user?.image ?? null,
        gender: (session?.user?.gender ?? 'male') as UserGender,
      }}
      canChangePassword={canChangePassword}
      initialStockUiPreferences={stockUiPreferences}
      initialDispensaryGrades={dispensaryGrades}
    />
  );
}
