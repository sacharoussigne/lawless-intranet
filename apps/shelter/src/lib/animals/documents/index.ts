import type {
  DocumentListItem,
  DocumentRecord,
  TemplateRecord,
} from '@lawless-intranet/types';
import { formatRpDate } from '@/lib/rpCalendar';
import { ANIMAL_STATUS_LABELS } from '@/lib/animals/labels';
import type { AnimalStatus } from '@/generated/prisma/client';

export const ANIMAL_DOCUMENT_TEMPLATE_TYPE = 'animal-document-template';
export const ANIMAL_DOCUMENT_TYPE = 'animal-document';

export type AnimalDocumentTemplateMetadata = {
  shelterId: string;
  defaultDocumentName?: string;
};

export type AnimalDocumentMetadata = {
  shelterId: string;
  animalId: string;
  templateId?: string | null;
  source: 'template' | 'freeText';
};

export type AnimalTemplateVariableSource = {
  shelterName: string;
  animal: {
    name: string;
    speciesName: string;
    breedName: string;
    variantName: string | null;
    arrivalDate: Date;
    adoptionPrice: number;
    status: AnimalStatus;
    caseManagerName: string;
    adopterName: string | null;
    departureDate: Date | null;
    biography: string | null;
    careProvided: string | null;
    notes: string | null;
  };
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringField(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const candidate = value[key];
  return typeof candidate === 'string' ? candidate : undefined;
}

function formatAdoptionPrice(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function buildAnimalTemplateVariables(
  source: AnimalTemplateVariableSource,
): Record<string, string> {
  return {
    shelterName: source.shelterName,
    animalName: source.animal.name,
    speciesName: source.animal.speciesName,
    breedName: source.animal.breedName,
    variantName: source.animal.variantName ?? '',
    arrivalDate: formatRpDate(source.animal.arrivalDate),
    adoptionPrice: formatAdoptionPrice(source.animal.adoptionPrice),
    status: ANIMAL_STATUS_LABELS[source.animal.status] ?? source.animal.status,
    caseManagerName: source.animal.caseManagerName,
    adopterName: source.animal.adopterName ?? '',
    departureDate: source.animal.departureDate
      ? formatRpDate(source.animal.departureDate)
      : '',
    biography: source.animal.biography ?? '',
    careProvided: source.animal.careProvided ?? '',
    notes: source.animal.notes ?? '',
  };
}

export function buildAnimalDocumentTemplateMetadata(
  shelterId: string,
  defaultDocumentName?: string,
): AnimalDocumentTemplateMetadata {
  return {
    shelterId,
    defaultDocumentName,
  };
}

export function buildAnimalDocumentMetadata(input: {
  shelterId: string;
  animalId: string;
  templateId?: string | null;
  source: 'template' | 'freeText';
}): AnimalDocumentMetadata {
  return {
    shelterId: input.shelterId,
    animalId: input.animalId,
    templateId: input.templateId ?? null,
    source: input.source,
  };
}

export function getDefaultAnimalDocumentName(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || !isObjectRecord(metadata)) return null;
  return readStringField(metadata, 'defaultDocumentName') ?? null;
}

export function parseAnimalDocumentTemplateMetadata(
  metadata: unknown,
): AnimalDocumentTemplateMetadata | null {
  if (!isObjectRecord(metadata)) return null;
  const shelterId = readStringField(metadata, 'shelterId');
  if (!shelterId) return null;

  return {
    shelterId,
    defaultDocumentName: readStringField(metadata, 'defaultDocumentName'),
  };
}

export function parseAnimalDocumentMetadata(
  metadata: unknown,
): AnimalDocumentMetadata | null {
  if (!isObjectRecord(metadata)) return null;

  const shelterId = readStringField(metadata, 'shelterId');
  const animalId = readStringField(metadata, 'animalId');
  const source = readStringField(metadata, 'source');

  if (
    !shelterId ||
    !animalId ||
    (source !== 'template' && source !== 'freeText')
  ) {
    return null;
  }

  return {
    shelterId,
    animalId,
    templateId: readStringField(metadata, 'templateId') ?? null,
    source,
  };
}

export function isShelterAnimalTemplate(
  template: Pick<TemplateRecord, 'type' | 'metadata'>,
  shelterId: string,
): boolean {
  if (template.type !== ANIMAL_DOCUMENT_TEMPLATE_TYPE) return false;
  const metadata = parseAnimalDocumentTemplateMetadata(template.metadata);
  return metadata?.shelterId === shelterId;
}

export function isAnimalDocumentForAnimal(
  document: Pick<DocumentListItem | DocumentRecord, 'type' | 'metadata'>,
  animalId: string,
): boolean {
  if (document.type !== ANIMAL_DOCUMENT_TYPE) return false;
  const metadata = parseAnimalDocumentMetadata(document.metadata);
  return metadata?.animalId === animalId;
}
