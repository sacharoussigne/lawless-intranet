import { getChests } from '@/app/_actions/chests';
import { getRoleChestAccesses } from '@/app/_actions/chestAccess';
import ChestsPageClient from './ChestsPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function ChestsContent({
  businessSlug,
  initialTab,
}: {
  businessSlug: string;
  initialTab: 'chests' | 'access';
}) {
  const [chestsResult, accessesResult] = await Promise.all([
    getChests(businessSlug),
    getRoleChestAccesses(businessSlug),
  ]);

  const chests = getDataOrThrow(chestsResult, 'Erreur lors du chargement des coffres');
  const accesses = getDataOrThrow(accessesResult, 'Erreur lors du chargement des accès aux coffres');

  return (
    <ChestsPageClient
      initialTab={initialTab}
      initialChests={chests}
      initialAccesses={accesses}
    />
  );
}

export default async function ChestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { businessSlug } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === 'access' ? 'access' : 'chests';

  return (
    <SuspenseLoader>
      <ChestsContent businessSlug={businessSlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
