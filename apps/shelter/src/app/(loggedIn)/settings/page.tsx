import { getAuthSession } from '@/lib/authSession';
import SettingsPageClient from './SettingsPageClient';
import type { UserGender } from '@lawless-intranet/types';

export default async function SettingsPage() {
  const session = await getAuthSession();
  const canChangePassword = Boolean(session?.user?.hasCredentialPassword);

  return (
    <SettingsPageClient
      initialUser={{
        name: session?.user?.name ?? '',
        image: session?.user?.image ?? null,
        gender: (session?.user?.gender ?? 'male') as UserGender,
      }}
      canChangePassword={canChangePassword}
    />
  );
}
