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
  animalsAccessAuth,
} from '@/lib/animals/auth';
import { documentTemplatesManageAuth } from '@/lib/animals/documentsAuth';
import {
  ANIMAL_DOCUMENT_TEMPLATE_TYPE,
  buildAnimalDocumentTemplateMetadata,
  getDefaultAnimalDocumentName,
  isShelterAnimalTemplate,
} from '@/lib/animals/documents';
import { getServerCookieHeader } from '@/lib/documents/getServerCookieHeader';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import type { AnimalDocumentTemplateListItem } from '@/types/animalDocuments';

const createTemplateSchema = z.object({
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
): AnimalDocumentTemplateListItem {
  const metadata = template.metadata as Record<string, unknown> | null | undefined;

  return {
    id: template.id,
    name: template.name,
    description: template.description ?? null,
    content: template.content,
    defaultDocumentName: getDefaultAnimalDocumentName(metadata),
    shelterId: String(metadata?.shelterId ?? template.scopeId),
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
  };
}

export async function listAnimalDocumentTemplates(shelterSlug: string) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!auth.ok) return auth.response;

    const cookieHeader = await getServerCookieHeader();
    const result = await listTemplates(
      {
        type: ANIMAL_DOCUMENT_TEMPLATE_TYPE,
        scopeId: auth.tenant.shelterId,
        ownerScope: 'org',
        pageSize: 50,
      },
      { cookieHeader },
    );

    const items = result.items
      .filter((template) => isShelterAnimalTemplate(template, auth.tenant.shelterId))
      .map(mapTemplate)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

    return { status: 200, data: items };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors du chargement des modèles de documents',
    );
  }
}

export async function getAnimalDocumentTemplate(
  shelterSlug: string,
  data: { id: string },
) {
  try {
    const validated = templateIdSchema.parse(data);
    const auth = await requireTenantServerActionContext(
      shelterSlug,
      documentTemplatesManageAuth,
    );
    if (!auth.ok) return auth.response;

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(validated.id, { cookieHeader });

    if (
      template.scopeId !== auth.tenant.shelterId ||
      !isShelterAnimalTemplate(template, auth.tenant.shelterId)
    ) {
      return { status: 404, error: 'Modèle introuvable' };
    }

    return { status: 200, data: mapTemplate(template) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors du chargement du modèle de document',
    );
  }
}

export async function createAnimalDocumentTemplate(
  shelterSlug: string,
  data: {
    name: string;
    description?: string;
    content: string;
    defaultDocumentName?: string;
  },
) {
  try {
    const validated = createTemplateSchema.parse(data);
    const auth = await requireTenantServerActionContext(
      shelterSlug,
      documentTemplatesManageAuth,
    );
    if (!auth.ok) return auth.response;

    const cookieHeader = await getServerCookieHeader();
    const template = await createTemplate(
      {
        type: ANIMAL_DOCUMENT_TEMPLATE_TYPE,
        scopeId: auth.tenant.shelterId,
        ownerId: null,
        name: validated.name,
        description: validated.description,
        content: validated.content,
        metadata: buildAnimalDocumentTemplateMetadata(
          auth.tenant.shelterId,
          validated.defaultDocumentName,
        ),
      },
      { cookieHeader },
    );

    return { status: 201, data: mapTemplate(template) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la création du modèle de document',
    );
  }
}

export async function updateAnimalDocumentTemplate(
  shelterSlug: string,
  data: {
    id: string;
    name: string;
    description?: string;
    content: string;
    defaultDocumentName?: string;
  },
) {
  try {
    const validated = updateTemplateSchema.parse(data);
    const auth = await requireTenantServerActionContext(
      shelterSlug,
      documentTemplatesManageAuth,
    );
    if (!auth.ok) return auth.response;

    const cookieHeader = await getServerCookieHeader();
    const existing = await getTemplate(validated.id, { cookieHeader });
    if (
      existing.scopeId !== auth.tenant.shelterId ||
      !isShelterAnimalTemplate(existing, auth.tenant.shelterId)
    ) {
      return { status: 404, error: 'Modèle introuvable' };
    }

    const template = await updateTemplate(
      validated.id,
      {
        name: validated.name,
        description: validated.description ?? null,
        content: validated.content,
        metadata: buildAnimalDocumentTemplateMetadata(
          auth.tenant.shelterId,
          validated.defaultDocumentName,
        ),
      },
      { cookieHeader },
    );

    return { status: 200, data: mapTemplate(template) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la modification du modèle de document',
    );
  }
}

export async function deleteAnimalDocumentTemplate(
  shelterSlug: string,
  data: { id: string },
) {
  try {
    const validated = templateIdSchema.parse(data);
    const auth = await requireTenantServerActionContext(
      shelterSlug,
      documentTemplatesManageAuth,
    );
    if (!auth.ok) return auth.response;

    const cookieHeader = await getServerCookieHeader();
    const existing = await getTemplate(validated.id, { cookieHeader });
    if (
      existing.scopeId !== auth.tenant.shelterId ||
      !isShelterAnimalTemplate(existing, auth.tenant.shelterId)
    ) {
      return { status: 404, error: 'Modèle introuvable' };
    }

    await deleteTemplate(validated.id, { cookieHeader });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la suppression du modèle de document',
    );
  }
}
