import type { AnimalStatus } from '@/generated/prisma/client';

export const ANIMAL_STATUS_LABELS: Record<AnimalStatus, string> = {
  in_care: 'En soins',
  awaiting_adoption: "En attente d'adoption",
  adopted: 'Adopté',
  deceased: 'Décédé',
};

export const ANIMAL_STATUS_OPTIONS = (
  Object.entries(ANIMAL_STATUS_LABELS) as [AnimalStatus, string][]
)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

export const ANIMAL_CORE_FIELDS = [
  'name',
  'speciesId',
  'breedId',
  'variantId',
  'arrivalDate',
  'adoptionPrice',
  'caseManagerUserId',
] as const;

export const ANIMAL_SOFT_FIELDS = [
  'status',
  'biography',
  'careProvided',
  'notes',
  'adopterName',
  'departureDate',
] as const;

export type AnimalCoreField = (typeof ANIMAL_CORE_FIELDS)[number];
export type AnimalSoftField = (typeof ANIMAL_SOFT_FIELDS)[number];
