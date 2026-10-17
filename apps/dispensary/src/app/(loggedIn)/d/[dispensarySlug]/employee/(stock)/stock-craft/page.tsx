import { getChestsList } from '@/app/_actions/chests';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { DispensaryCraftQueueWorkspace } from './DispensaryCraftQueueWorkspace';

async function CraftQueueContent({ dispensarySlug }: { dispensarySlug: string }) {
  const chests = getDataOrThrow(
    await getChestsList(dispensarySlug, true),
    'Erreur lors du chargement des coffres',
  );
  return <DispensaryCraftQueueWorkspace dispensarySlug={dispensarySlug} chests={chests} />;
}

export default async function CraftQueuePage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  return (
    <SuspenseLoader>
      <CraftQueueContent dispensarySlug={dispensarySlug} />
    </SuspenseLoader>
  );
}
