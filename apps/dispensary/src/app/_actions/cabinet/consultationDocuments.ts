'use server';

import { z } from 'zod/v3';
import {
  createDocument,
  deleteDocument,
  getDocument,
  getTemplate,
  listDocuments,
  updateDocument,
} from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import {
  buildUserTemplateRenderContext,
  renderTemplate,
} from '@lawless-intranet/mail-template-engine';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { getMemberDescription } from '@/lib/dispensary/memberDescription';
import {
  getCabinetSessionContext,
  guardCabinetRead,
  guardCabinetWrite,
} from '@/app/_actions/cabinet/internals';
import { parseCustomValuesFromDb } from '@/lib/cabinet/formSchema';
import {
  buildConsultationDocumentMetadata,
  buildConsultationTemplateVariables,
  getDefaultConsultationDocumentName,
  CONSULTATION_DOCUMENT_TYPE,
  isConsultationDocumentForConsultation,
  parseConsultationDocumentMetadata,
} from '@/lib/cabinet/documents';
import type { ConsultationDocumentListItem } from '@/types/cabinetDocuments';
import { getServerCookieHeader } from '@/lib/documents/mailDocuments';

const createFreeTextSchema = z.object({
  consultationId: z.string().uuid('Consultation invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const createFromTemplateSchema = z.object({
  consultationId: z.string().uuid('Consultation invalide'),
  templateId: z.string().uuid('Template invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const updateDocumentSchema = z.object({
  id: z.string().uuid('ID invalide'),
  consultationId: z.string().uuid('Consultation invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const deleteDocumentSchema = z.object({
  id: z.string().uuid('ID invalide'),
  consultationId: z.string().uuid('Consultation invalide'),
});

function documentsActionError(error: unknown, fallback: string) {
  if (error instanceof DocumentsClientError) {
    return { status: error.status, error: error.message };
  }
  return actionErrorParser(error, fallback);
}

type ConsultationDocumentSource = {
  consultationId: string;
  careEpisodeId: string;
  patientId: string;
  cabinetId: string;
  cabinetName: string;
  consultationDate: Date;
  patientFirstName: string;
  patientLastName: string;
  patientBirthDate: Date | null;
  patientCustomValues: Record<string, string | null>;
  careEpisodeMotif: string;
  careEpisodeStartedAt: Date;
  careEpisodeCustomValues: Record<string, string | null>;
  consultationCustomValues: Record<string, string | null>;
};

async function getConsultationDocumentSource(
  dispensaryId: string,
  consultationId: string,
): Promise<ConsultationDocumentSource | null> {
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      careEpisode: { patient: { cabinet: tenantWhere(dispensaryId) } },
    },
    select: {
      id: true,
      date: true,
      customValues: true,
      careEpisode: {
        select: {
          id: true,
          motif: true,
          startedAt: true,
          customValues: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              birthDate: true,
              customValues: true,
              cabinetId: true,
              cabinet: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!consultation) return null;

  return {
    consultationId: consultation.id,
    careEpisodeId: consultation.careEpisode.id,
    patientId: consultation.careEpisode.patient.id,
    cabinetId: consultation.careEpisode.patient.cabinetId,
    cabinetName: consultation.careEpisode.patient.cabinet.name,
    consultationDate: consultation.date,
    patientFirstName: consultation.careEpisode.patient.firstName,
    patientLastName: consultation.careEpisode.patient.lastName,
    patientBirthDate: consultation.careEpisode.patient.birthDate,
    patientCustomValues: parseCustomValuesFromDb(consultation.careEpisode.patient.customValues),
    careEpisodeMotif: consultation.careEpisode.motif,
    careEpisodeStartedAt: consultation.careEpisode.startedAt,
    careEpisodeCustomValues: parseCustomValuesFromDb(consultation.careEpisode.customValues),
    consultationCustomValues: parseCustomValuesFromDb(consultation.customValues),
  };
}

function mapDocument(
  document:
    | Awaited<ReturnType<typeof getDocument>>
    | Awaited<ReturnType<typeof listDocuments>>['items'][number],
): ConsultationDocumentListItem {
  const metadata = parseConsultationDocumentMetadata(document.metadata);

  return {
    id: document.id,
    name: document.name,
    content: 'content' in document ? document.content : document.contentPreview,
    contentPreview: 'contentPreview' in document ? document.contentPreview : document.content,
    cabinetId: metadata?.cabinetId ?? '',
    patientId: metadata?.patientId ?? '',
    careEpisodeId: metadata?.careEpisodeId ?? '',
    consultationId: metadata?.consultationId ?? '',
    templateId: metadata?.templateId ?? null,
    source: metadata?.source ?? 'freeText',
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
  };
}

export async function listConsultationDocuments(
  dispensarySlug: string,
  consultationId: string,
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const source = await getConsultationDocumentSource(ctx.tenant.dispensaryId, consultationId);
    if (!source) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      source.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cookieHeader = await getServerCookieHeader();
    const result = await listDocuments(
      {
        type: CONSULTATION_DOCUMENT_TYPE,
        scopeId: ctx.tenant.dispensaryId,
        pageSize: 50,
      },
      { cookieHeader },
    );

    const items = result.items
      .filter((document) => isConsultationDocumentForConsultation(document, consultationId))
      .map(mapDocument)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { status: 200, data: items };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors du chargement des prescriptions de la consultation',
    );
  }
}

export async function createFreeTextConsultationDocument(
  dispensarySlug: string,
  data: {
    consultationId: string;
    name: string;
    content: string;
  },
) {
  try {
    const validated = createFreeTextSchema.parse(data);
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const source = await getConsultationDocumentSource(
      ctx.tenant.dispensaryId,
      validated.consultationId,
    );
    if (!source) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      source.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cookieHeader = await getServerCookieHeader();
    const document = await createDocument(
      {
        type: CONSULTATION_DOCUMENT_TYPE,
        scopeId: ctx.tenant.dispensaryId,
        name: validated.name,
        content: validated.content,
        metadata: buildConsultationDocumentMetadata({
          cabinetId: source.cabinetId,
          patientId: source.patientId,
          careEpisodeId: source.careEpisodeId,
          consultationId: source.consultationId,
          source: 'freeText',
        }),
      },
      { cookieHeader },
    );

    return { status: 201, data: mapDocument(document) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la création de la prescription',
    );
  }
}

export async function createConsultationDocumentFromTemplate(
  dispensarySlug: string,
  data: {
    consultationId: string;
    templateId: string;
    name: string;
    content: string;
  },
) {
  try {
    const validated = createFromTemplateSchema.parse(data);
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const source = await getConsultationDocumentSource(
      ctx.tenant.dispensaryId,
      validated.consultationId,
    );
    if (!source) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      source.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(validated.templateId, { cookieHeader });
    const templateMetadata = parseConsultationDocumentMetadata({
      ...template.metadata,
      patientId: source.patientId,
      careEpisodeId: source.careEpisodeId,
      consultationId: source.consultationId,
      source: 'template',
    });

    const isSameCabinet =
      typeof (template.metadata as Record<string, unknown> | null | undefined)?.cabinetId ===
        'string' &&
      (template.metadata as Record<string, unknown>).cabinetId === source.cabinetId;
    if (template.scopeId !== ctx.tenant.dispensaryId || template.type !== 'consultation-document-template' || !isSameCabinet) {
      return { status: 404, error: 'Template introuvable' };
    }

    const document = await createDocument(
      {
        type: CONSULTATION_DOCUMENT_TYPE,
        scopeId: ctx.tenant.dispensaryId,
        name: validated.name,
        content: validated.content,
        metadata: buildConsultationDocumentMetadata({
          cabinetId: source.cabinetId,
          patientId: source.patientId,
          careEpisodeId: source.careEpisodeId,
          consultationId: source.consultationId,
          templateId: template.id,
          source: templateMetadata?.source ?? 'template',
        }),
      },
      { cookieHeader },
    );

    return { status: 201, data: mapDocument(document) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la création de la prescription depuis le template',
    );
  }
}

export async function updateConsultationDocument(
  dispensarySlug: string,
  data: {
    id: string;
    consultationId: string;
    name: string;
    content: string;
  },
) {
  try {
    const validated = updateDocumentSchema.parse(data);
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const source = await getConsultationDocumentSource(
      ctx.tenant.dispensaryId,
      validated.consultationId,
    );
    if (!source) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      source.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cookieHeader = await getServerCookieHeader();
    const existing = await getDocument(validated.id, { cookieHeader });
    const metadata = parseConsultationDocumentMetadata(existing.metadata);
    if (
      existing.scopeId !== ctx.tenant.dispensaryId ||
      existing.type !== CONSULTATION_DOCUMENT_TYPE ||
      metadata?.consultationId !== validated.consultationId
    ) {
      return { status: 404, error: 'Document introuvable' };
    }

    const document = await updateDocument(
      validated.id,
      {
        name: validated.name,
        content: validated.content,
        metadata: existing.metadata as Record<string, unknown> | null,
      },
      { cookieHeader },
    );

    return { status: 200, data: mapDocument(document) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la mise à jour de la prescription',
    );
  }
}

export async function deleteConsultationDocument(
  dispensarySlug: string,
  data: { id: string; consultationId: string },
) {
  try {
    const validated = deleteDocumentSchema.parse(data);
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const source = await getConsultationDocumentSource(
      ctx.tenant.dispensaryId,
      validated.consultationId,
    );
    if (!source) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      source.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cookieHeader = await getServerCookieHeader();
    const existing = await getDocument(validated.id, { cookieHeader });
    const metadata = parseConsultationDocumentMetadata(existing.metadata);
    if (
      existing.scopeId !== ctx.tenant.dispensaryId ||
      existing.type !== CONSULTATION_DOCUMENT_TYPE ||
      metadata?.consultationId !== validated.consultationId
    ) {
      return { status: 404, error: 'Document introuvable' };
    }

    await deleteDocument(validated.id, { cookieHeader });
    return { status: 200, data: { success: true } };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la suppression de la prescription',
    );
  }
}

export async function generateConsultationDocumentPreview(
  dispensarySlug: string,
  data: { consultationId: string; templateId: string },
) {
  try {
    const validated = z
      .object({
        consultationId: z.string().uuid('Consultation invalide'),
        templateId: z.string().uuid('Template invalide'),
      })
      .parse(data);

    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const source = await getConsultationDocumentSource(
      ctx.tenant.dispensaryId,
      validated.consultationId,
    );
    if (!source) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      source.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(validated.templateId, { cookieHeader });
    const templateCabinetId =
      typeof (template.metadata as Record<string, unknown> | null | undefined)?.cabinetId ===
      'string'
        ? (template.metadata as Record<string, unknown>).cabinetId
        : null;

    if (
      template.scopeId !== ctx.tenant.dispensaryId ||
      template.type !== 'consultation-document-template' ||
      templateCabinetId !== source.cabinetId
    ) {
      return { status: 404, error: 'Template introuvable' };
    }

    const variables = buildConsultationTemplateVariables({
      cabinetName: source.cabinetName,
      patient: {
        firstName: source.patientFirstName,
        lastName: source.patientLastName,
        birthDate: source.patientBirthDate,
        customValues: source.patientCustomValues,
      },
      careEpisode: {
        motif: source.careEpisodeMotif,
        startedAt: source.careEpisodeStartedAt,
        customValues: source.careEpisodeCustomValues,
      },
      consultation: {
        date: source.consultationDate,
        customValues: source.consultationCustomValues,
      },
    });
    const memberDescription =
      (await getMemberDescription(ctx.tenant.dispensaryId, ctx.session.user.id)) ?? '';
    const preview = renderTemplate(
      template.content,
      buildUserTemplateRenderContext({
        inputs: {},
        username: ctx.session.user.name || 'Utilisateur',
        userDescription: memberDescription,
        userGender: ctx.session.user.gender ?? 'male',
        variables,
      }),
    );

    const defaultName =
      getDefaultConsultationDocumentName(
        template.metadata as Record<string, unknown> | null | undefined,
      ) ??
      `Prescription - ${source.patientFirstName} ${source.patientLastName}`;

    return {
      status: 200,
      data: {
        templateId: template.id,
        templateName: template.name,
        templateContent: template.content,
        preview,
        variables,
        suggestedName: defaultName,
      },
    };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la génération de l’aperçu de la prescription',
    );
  }
}
