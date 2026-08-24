import { getAnimal } from '@/app/_actions/animals';
import { listAnimalDocumentTemplates } from '@/app/_actions/animalDocumentTemplates';
import { listAnimalDocuments } from '@/app/_actions/animalDocuments';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { requireTenantActionContext } from '@/lib/shelter/serverActionContext';
import { AnimalDetailPageClient } from './AnimalDetailPageClient';
import type { AnimalDTO } from '../types';

async function AnimalDetailContent({
  shelterSlug,
  animalId,
}: {
  shelterSlug: string;
  animalId: string;
}) {
  const tenant = await requireTenantActionContext(shelterSlug);
  const shelterName = tenant.ok ? tenant.ctx.shelter.name : 'Refuge';

  const [animalResult, documentsResult, templatesResult] = await Promise.all([
    getAnimal(shelterSlug, animalId),
    listAnimalDocuments(shelterSlug, animalId),
    listAnimalDocumentTemplates(shelterSlug),
  ]);

  const animal = getDataOrThrow(animalResult, "Erreur lors du chargement de l'animal");

  return (
    <AnimalDetailPageClient
      shelterSlug={shelterSlug}
      shelterName={shelterName}
      initialAnimal={animal as AnimalDTO}
      initialDocuments={
        documentsResult.status === 200 && 'data' in documentsResult
          ? (documentsResult.data ?? [])
          : []
      }
      availableTemplates={
        templatesResult.status === 200 && 'data' in templatesResult
          ? (templatesResult.data ?? [])
          : []
      }
    />
  );
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
