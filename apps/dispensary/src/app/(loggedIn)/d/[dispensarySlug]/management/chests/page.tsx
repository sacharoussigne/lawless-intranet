import { getChests } from '@/app/_actions/chests';
import { getRoleChestAccesses } from '@/app/_actions/chestAccess';
import ChestsPageClient from './ChestsPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function ChestsContent({
  dispensarySlug,
  initialTab,
}: {
  dispensarySlug: string;
  initialTab: 'chests' | 'access';
}) {
  const [chestsResult, accessesResult] = await Promise.all([
    getChests(dispensarySlug),
    getRoleChestAccesses(dispensarySlug),
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
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { dispensarySlug } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === 'access' ? 'access' : 'chests';

  return (
    <SuspenseLoader>
      <ChestsContent dispensarySlug={dispensarySlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
