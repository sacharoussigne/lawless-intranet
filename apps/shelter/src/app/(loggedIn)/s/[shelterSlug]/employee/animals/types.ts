import type { AnimalStatus } from '@/generated/prisma/client';

export type AnimalBreedRefDTO = {
  id: string;
  name: string;
  shelterPurchasePrice: number | null;
  animalierPurchasePrice: number | null;
};

export type AnimalDTO = {
  id: string;
  shelterId: string;
  name: string;
  speciesId: string;
  breedId: string;
  variantId: string | null;
  arrivalDate: string;
  adoptionPrice: number;
  caseManagerUserId: string;
  status: AnimalStatus;
  biography: string | null;
  careProvided: string | null;
  notes: string | null;
  adopterName: string | null;
  departureDate: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  species: { id: string; name: string };
  breed: AnimalBreedRefDTO;
  variant: { id: string; label: string } | null;
  caseManagerName: string;
};

export type SpeciesOptionDTO = {
  id: string;
  name: string;
  breeds: {
    id: string;
    name: string;
    shelterPurchasePrice: number | null;
    animalierPurchasePrice: number | null;
    variants: { id: string; label: string }[];
  }[];
};

export type CaseManagerOptionDTO = {
  userId: string;
  name: string;
};

export type AnimalHistoryDTO = {
  id: string;
  action: 'create' | 'update' | 'delete';
  actorUserId: string | null;
  actorName: string | null;
  previousValues: unknown;
  nextValues: unknown;
  createdAt: string;
};

export function parseIsoDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toIsoDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function actionErrorMessage(
  result: { status: number; error?: string | Array<{ message: string }> },
  fallback: string,
): string {
  if (typeof result.error === 'string') return result.error;
  if (Array.isArray(result.error)) return result.error.map((e) => e.message).join(', ');
  return fallback;
}
