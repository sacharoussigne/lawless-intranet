import { listAnimals } from '@/app/_actions/animals';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { AnimalsPageClient } from './AnimalsPageClient';
import type { AnimalDTO } from './types';

async function AnimalsContent({ shelterSlug }: { shelterSlug: string }) {
  const result = await listAnimals(shelterSlug);
  const initialAnimals = getDataOrThrow(result, 'Erreur lors du chargement des animaux');
  return (
    <AnimalsPageClient shelterSlug={shelterSlug} initialAnimals={initialAnimals as AnimalDTO[]} />
  );
}

export default async function AnimalsPage({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  return (
    <SuspenseLoader>
      <AnimalsContent shelterSlug={shelterSlug} />
    </SuspenseLoader>
  );
}
