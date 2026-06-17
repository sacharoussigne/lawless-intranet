import { getAuthSession } from '@/lib/authSession';
import SettingsPageClient from './SettingsPageClient';
import { getMyStockUiPreferences } from '@/app/_actions/stockUiPreferences';
import { getDataOrThrow } from '@/lib/response';

export default async function SettingsPage() {
  const session = await getAuthSession();
  const canChangePassword = Boolean(session?.user?.hasCredentialPassword);

  const stockUiPreferencesResult = await getMyStockUiPreferences();
  const stockUiPreferences = getDataOrThrow(stockUiPreferencesResult, 'Erreur lors du chargement des préférences');

  return (
    <SettingsPageClient
      initialUser={{
        name: session?.user?.name ?? '',
        image: session?.user?.image ?? null,
      }}
      canChangePassword={canChangePassword}
      initialStockUiPreferences={stockUiPreferences}
    />
  );
}
