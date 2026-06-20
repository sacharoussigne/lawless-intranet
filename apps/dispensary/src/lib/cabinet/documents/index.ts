import type {
  DocumentListItem,
  DocumentRecord,
  TemplateRecord,
} from '@lawless-intranet/types';
import { formatRpDate } from '@/lib/rpCalendar';

export const CONSULTATION_DOCUMENT_TEMPLATE_TYPE = 'consultation-document-template';
export const CONSULTATION_DOCUMENT_TYPE = 'consultation-document';
export const CONSULTATION_DOCUMENT_KIND = 'prescription';

export type ConsultationDocumentKind = typeof CONSULTATION_DOCUMENT_KIND;

export type ConsultationDocumentTemplateMetadata = {
  cabinetId: string;
  documentKind: ConsultationDocumentKind;
  defaultDocumentName?: string;
};

export type ConsultationDocumentMetadata = {
  cabinetId: string;
  patientId: string;
  careEpisodeId: string;
  consultationId: string;
  templateId?: string | null;
  documentKind: ConsultationDocumentKind;
  source: 'template' | 'freeText';
};

export type ConsultationTemplateVariableSource = {
  cabinetName: string;
  patient: {
    firstName: string;
    lastName: string;
    birthDate: Date | null;
    customValues?: Record<string, string | null>;
  };
  careEpisode: {
    motif: string;
    startedAt: Date;
    customValues?: Record<string, string | null>;
  };
  consultation: {
    date: Date;
    customValues?: Record<string, string | null>;
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

function appendCustomVariables(
  target: Record<string, string>,
  prefix: string,
  values?: Record<string, string | null>,
) {
  if (!values) return;

  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    target[`${prefix}_${key}`] = value;
  }
}

export function buildConsultationTemplateVariables(
  source: ConsultationTemplateVariableSource,
): Record<string, string> {
  const patientFullName = `${source.patient.firstName} ${source.patient.lastName}`.trim();
  const variables: Record<string, string> = {
    cabinetName: source.cabinetName,
    patientFirstName: source.patient.firstName,
    patientLastName: source.patient.lastName,
    patientFullName,
    patientBirthDate: source.patient.birthDate ? formatRpDate(source.patient.birthDate) : '',
    careEpisodeMotif: source.careEpisode.motif,
    careEpisodeStartedAt: formatRpDate(source.careEpisode.startedAt),
    consultationDate: formatRpDate(source.consultation.date),
  };

  appendCustomVariables(variables, 'patient', source.patient.customValues);
  appendCustomVariables(variables, 'careEpisode', source.careEpisode.customValues);
  appendCustomVariables(variables, 'consultation', source.consultation.customValues);

  return variables;
}

export function buildConsultationDocumentTemplateMetadata(
  cabinetId: string,
  defaultDocumentName?: string,
): ConsultationDocumentTemplateMetadata {
  return {
    cabinetId,
    documentKind: CONSULTATION_DOCUMENT_KIND,
    defaultDocumentName,
  };
}

export function buildConsultationDocumentMetadata(input: {
  cabinetId: string;
  patientId: string;
  careEpisodeId: string;
  consultationId: string;
  templateId?: string | null;
  source: 'template' | 'freeText';
}): ConsultationDocumentMetadata {
  return {
    cabinetId: input.cabinetId,
    patientId: input.patientId,
    careEpisodeId: input.careEpisodeId,
    consultationId: input.consultationId,
    templateId: input.templateId ?? null,
    documentKind: CONSULTATION_DOCUMENT_KIND,
    source: input.source,
  };
}

export function getDefaultConsultationDocumentName(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || !isObjectRecord(metadata)) return null;
  return readStringField(metadata, 'defaultDocumentName') ?? null;
}

export function parseConsultationDocumentTemplateMetadata(
  metadata: unknown,
): ConsultationDocumentTemplateMetadata | null {
  if (!isObjectRecord(metadata)) return null;
  const cabinetId = readStringField(metadata, 'cabinetId');
  const documentKind = readStringField(metadata, 'documentKind');
  if (!cabinetId || documentKind !== CONSULTATION_DOCUMENT_KIND) return null;

  return {
    cabinetId,
    documentKind: CONSULTATION_DOCUMENT_KIND,
    defaultDocumentName: readStringField(metadata, 'defaultDocumentName'),
  };
}

export function parseConsultationDocumentMetadata(
  metadata: unknown,
): ConsultationDocumentMetadata | null {
  if (!isObjectRecord(metadata)) return null;

  const cabinetId = readStringField(metadata, 'cabinetId');
  const patientId = readStringField(metadata, 'patientId');
  const careEpisodeId = readStringField(metadata, 'careEpisodeId');
  const consultationId = readStringField(metadata, 'consultationId');
  const documentKind = readStringField(metadata, 'documentKind');
  const source = readStringField(metadata, 'source');

  if (
    !cabinetId ||
    !patientId ||
    !careEpisodeId ||
    !consultationId ||
    documentKind !== CONSULTATION_DOCUMENT_KIND ||
    (source !== 'template' && source !== 'freeText')
  ) {
    return null;
  }

  return {
    cabinetId,
    patientId,
    careEpisodeId,
    consultationId,
    templateId: readStringField(metadata, 'templateId') ?? null,
    documentKind: CONSULTATION_DOCUMENT_KIND,
    source,
  };
}

export function isCabinetConsultationTemplate(
  template: Pick<TemplateRecord, 'type' | 'metadata'>,
  cabinetId: string,
): boolean {
  if (template.type !== CONSULTATION_DOCUMENT_TEMPLATE_TYPE) return false;
  const metadata = parseConsultationDocumentTemplateMetadata(template.metadata);
  return metadata?.cabinetId === cabinetId;
}

export function isConsultationDocumentForConsultation(
  document: Pick<DocumentListItem | DocumentRecord, 'type' | 'metadata'>,
  consultationId: string,
): boolean {
  if (document.type !== CONSULTATION_DOCUMENT_TYPE) return false;
  const metadata = parseConsultationDocumentMetadata(document.metadata);
  return metadata?.consultationId === consultationId;
}
