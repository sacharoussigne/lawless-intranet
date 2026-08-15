import { getAnimal } from '@/app/_actions/animals';
import { getAnimalFollowUp } from '@/app/_actions/followUps';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { NotFoundError } from '@/lib/errors/NoFoundError';
import { getDataOrThrow } from '@/lib/response';
import type { AnimalDTO } from '../../../types';
import type { FollowUpDTO } from '../../followUpTypes';
import { FollowUpDetailPageClient } from './FollowUpDetailPageClient';

async function FollowUpDetailContent({
  shelterSlug,
  animalId,
  followUpId,
}: {
  shelterSlug: string;
  animalId: string;
  followUpId: string;
}) {
  const [animalResult, followUpResult] = await Promise.all([
    getAnimal(shelterSlug, animalId),
    getAnimalFollowUp(shelterSlug, followUpId),
  ]);
  const animal = getDataOrThrow(animalResult, "Erreur lors du chargement de l'animal") as AnimalDTO;
  const followUp = getDataOrThrow(
    followUpResult,
    'Erreur lors du chargement du suivi',
  ) as FollowUpDTO;

  if (followUp.animalId !== animal.id) {
    throw new NotFoundError('Suivi introuvable pour cet animal');
  }

  return (
    <FollowUpDetailPageClient
      shelterSlug={shelterSlug}
      animal={animal}
      initialFollowUp={followUp}
    />
  );
}

export default async function FollowUpDetailPage({
  params,
}: {
  params: Promise<{ shelterSlug: string; animalId: string; followUpId: string }>;
}) {
  const { shelterSlug, animalId, followUpId } = await params;
  return (
    <SuspenseLoader>
      <FollowUpDetailContent
        shelterSlug={shelterSlug}
        animalId={animalId}
        followUpId={followUpId}
      />
    </SuspenseLoader>
  );
}
