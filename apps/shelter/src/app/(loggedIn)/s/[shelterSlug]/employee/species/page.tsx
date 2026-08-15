import { listSpecies } from '@/app/_actions/species';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { SpeciesPageClient } from './SpeciesPageClient';

async function SpeciesContent({ shelterSlug }: { shelterSlug: string }) {
  const result = await listSpecies(shelterSlug);
  const initialSpecies = getDataOrThrow(result, 'Erreur lors du chargement des espèces');
  return <SpeciesPageClient shelterSlug={shelterSlug} initialSpecies={initialSpecies} />;
}

export default async function SpeciesPage({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  return (
    <SuspenseLoader>
      <SpeciesContent shelterSlug={shelterSlug} />
    </SuspenseLoader>
  );
}
