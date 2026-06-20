'use server';

import { z } from 'zod/v3';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import { actionErrorParser } from '@/lib/action';
import {
  getDefaultConsultationDocumentName,
  buildConsultationDocumentTemplateMetadata,
  CONSULTATION_DOCUMENT_TEMPLATE_TYPE,
  isCabinetConsultationTemplate,
} from '@/lib/cabinet/documents';
import {
  getCabinetSessionContext,
  guardCabinetOwner,
  guardCabinetRead,
} from '@/app/_actions/cabinet/internals';
import type { ConsultationDocumentTemplateListItem } from '@/types/cabinetDocuments';
import { getServerCookieHeader } from '@/lib/documents/mailDocuments';

const createTemplateSchema = z.object({
  cabinetId: z.string().uuid('Cabinet invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  description: z.string().trim().optional(),
  content: z.string().min(1, 'Le contenu est requis'),
  defaultDocumentName: z.string().trim().max(255, 'Le nom par défaut est trop long').optional(),
});

const updateTemplateSchema = createTemplateSchema.extend({
  id: z.string().uuid('ID invalide'),
});

const templateIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

function documentsActionError(error: unknown, fallback: string) {
  if (error instanceof DocumentsClientError) {
    return { status: error.status, error: error.message };
  }
  return actionErrorParser(error, fallback);
}

function mapTemplate(
  template: Awaited<ReturnType<typeof getTemplate>>,
): ConsultationDocumentTemplateListItem {
  const metadata = template.metadata as Record<string, unknown> | null | undefined;

  return {
    id: template.id,
    name: template.name,
    description: template.description ?? null,
    content: template.content,
    defaultDocumentName: getDefaultConsultationDocumentName(metadata),
    cabinetId: String(metadata?.cabinetId ?? ''),
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
  };
}

async function requireCabinetTemplateReadContext(
  dispensarySlug: string,
  cabinetId: string,
) {
  const ctx = await getCabinetSessionContext(dispensarySlug);
  if (!ctx.ok) return ctx;

  const guard = await guardCabinetRead(
    ctx.tenant.dispensaryId,
    cabinetId,
    ctx.session,
    ctx.tenant.effectiveRole,
  );
  if (!guard.ok) {
    return {
      ok: false as const,
      response: { status: guard.status, error: guard.error },
    };
  }

  return { ok: true as const, ctx };
}

async function requireCabinetTemplateOwnerContext(
  dispensarySlug: string,
  cabinetId: string,
) {
  const ctx = await getCabinetSessionContext(dispensarySlug);
  if (!ctx.ok) return ctx;

  const guard = await guardCabinetOwner(
    ctx.tenant.dispensaryId,
    cabinetId,
    ctx.session,
    ctx.tenant.effectiveRole,
  );
  if (!guard.ok) {
    return {
      ok: false as const,
      response: { status: guard.status, error: guard.error },
    };
  }

  return { ok: true as const, ctx };
}

export async function listConsultationDocumentTemplates(
  dispensarySlug: string,
  cabinetId: string,
) {
  try {
    const access = await requireCabinetTemplateReadContext(dispensarySlug, cabinetId);
    if (!access.ok) return access.response;

    const cookieHeader = await getServerCookieHeader();
    const result = await listTemplates(
      {
        type: CONSULTATION_DOCUMENT_TEMPLATE_TYPE,
        scopeId: access.ctx.tenant.dispensaryId,
        ownerScope: 'org',
        pageSize: 50,
      },
      { cookieHeader },
    );

    const items = result.items
      .filter((template) => isCabinetConsultationTemplate(template, cabinetId))
      .map(mapTemplate)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { status: 200, data: items };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors du chargement des templates de prescription',
    );
  }
}

export async function getConsultationDocumentTemplate(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const validated = templateIdSchema.parse(data);
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(validated.id, { cookieHeader });

    if (template.scopeId !== ctx.tenant.dispensaryId) {
      return { status: 404, error: 'Template introuvable' };
    }

    const metadata = template.metadata as Record<string, unknown> | null | undefined;
    const cabinetId = typeof metadata?.cabinetId === 'string' ? metadata.cabinetId : null;
    if (!cabinetId || !isCabinetConsultationTemplate(template, cabinetId)) {
      return { status: 404, error: 'Template introuvable' };
    }

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    return { status: 200, data: mapTemplate(template) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors du chargement du template de prescription',
    );
  }
}

export async function createConsultationDocumentTemplate(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    name: string;
    description?: string;
    content: string;
    defaultDocumentName?: string;
  },
) {
  try {
    const validated = createTemplateSchema.parse(data);
    const access = await requireCabinetTemplateOwnerContext(
      dispensarySlug,
      validated.cabinetId,
    );
    if (!access.ok) return access.response;

    const cookieHeader = await getServerCookieHeader();
    const template = await createTemplate(
      {
        type: CONSULTATION_DOCUMENT_TEMPLATE_TYPE,
        scopeId: access.ctx.tenant.dispensaryId,
        ownerId: null,
        name: validated.name,
        description: validated.description,
        content: validated.content,
        metadata: buildConsultationDocumentTemplateMetadata(
          validated.cabinetId,
          validated.defaultDocumentName,
        ),
      },
      { cookieHeader },
    );

    return { status: 201, data: mapTemplate(template) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la création du template de prescription',
    );
  }
}

export async function updateConsultationDocumentTemplate(
  dispensarySlug: string,
  data: {
    id: string;
    cabinetId: string;
    name: string;
    description?: string;
    content: string;
    defaultDocumentName?: string;
  },
) {
  try {
    const validated = updateTemplateSchema.parse(data);
    const access = await requireCabinetTemplateOwnerContext(
      dispensarySlug,
      validated.cabinetId,
    );
    if (!access.ok) return access.response;

    const cookieHeader = await getServerCookieHeader();
    const existing = await getTemplate(validated.id, { cookieHeader });
    if (
      existing.scopeId !== access.ctx.tenant.dispensaryId ||
      !isCabinetConsultationTemplate(existing, validated.cabinetId)
    ) {
      return { status: 404, error: 'Template introuvable' };
    }

    const template = await updateTemplate(
      validated.id,
      {
        name: validated.name,
        description: validated.description ?? null,
        content: validated.content,
        metadata: buildConsultationDocumentTemplateMetadata(
          validated.cabinetId,
          validated.defaultDocumentName,
        ),
      },
      { cookieHeader },
    );

    return { status: 200, data: mapTemplate(template) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la modification du template de prescription',
    );
  }
}

export async function deleteConsultationDocumentTemplate(
  dispensarySlug: string,
  data: { id: string; cabinetId: string },
) {
  try {
    const validated = updateTemplateSchema.pick({ id: true, cabinetId: true }).parse(data);
    const access = await requireCabinetTemplateOwnerContext(
      dispensarySlug,
      validated.cabinetId,
    );
    if (!access.ok) return access.response;

    const cookieHeader = await getServerCookieHeader();
    const existing = await getTemplate(validated.id, { cookieHeader });
    if (
      existing.scopeId !== access.ctx.tenant.dispensaryId ||
      !isCabinetConsultationTemplate(existing, validated.cabinetId)
    ) {
      return { status: 404, error: 'Template introuvable' };
    }

    await deleteTemplate(validated.id, { cookieHeader });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la suppression du template de prescription',
    );
  }
}
