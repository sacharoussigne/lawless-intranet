import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/authSession';
import { AccountPageClient } from './AccountPageClient';

export const metadata: Metadata = { title: 'Profil' };

/** Profile tab of the phone app: account, theme, dispensary switch, logout. */
export default async function AccountPage() {
  // The middleware already requires a session on tenant pages.
  const session = await getAuthSession();
  if (!session) redirect('/');

  return <AccountPageClient name={session.user.name} email={session.user.email} image={session.user.image ?? null} />;
}
