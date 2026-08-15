import { getAnimal } from '@/app/_actions/animals';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { AnimalDetailPageClient } from './AnimalDetailPageClient';
import type { AnimalDTO } from '../types';

async function AnimalDetailContent({
  shelterSlug,
  animalId,
}: {
  shelterSlug: string;
  animalId: string;
}) {
  const result = await getAnimal(shelterSlug, animalId);
  const animal = getDataOrThrow(result, "Erreur lors du chargement de l'animal");
  return <AnimalDetailPageClient shelterSlug={shelterSlug} initialAnimal={animal as AnimalDTO} />;
}

export default async function AnimalDetailPage({
  params,
}: {
  params: Promise<{ shelterSlug: string; animalId: string }>;
}) {
  const { shelterSlug, animalId } = await params;
  return (
    <SuspenseLoader>
      <AnimalDetailContent shelterSlug={shelterSlug} animalId={animalId} />
    </SuspenseLoader>
  );
}
