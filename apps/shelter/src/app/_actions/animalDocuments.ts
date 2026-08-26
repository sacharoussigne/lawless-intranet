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
import { actionErrorParser } from '@/lib/action';
import {
  animalsAccessAuth,
  animalsUpdateAuth,
} from '@/lib/animals/auth';
import {
  ANIMAL_DOCUMENT_TEMPLATE_TYPE,
  ANIMAL_DOCUMENT_TYPE,
  buildAnimalDocumentMetadata,
  isAnimalDocumentForAnimal,
  isShelterAnimalTemplate,
  parseAnimalDocumentMetadata,
} from '@/lib/animals/documents';
import { getServerCookieHeader } from '@/lib/documents/getServerCookieHeader';
import prisma from '@/lib/prisma';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import type { AnimalDocumentListItem } from '@/types/animalDocuments';

const createFreeTextSchema = z.object({
  animalId: z.string().uuid('Animal invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const createFromTemplateSchema = z.object({
  animalId: z.string().uuid('Animal invalide'),
  templateId: z.string().uuid('Modèle invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const updateDocumentSchema = z.object({
  id: z.string().uuid('ID invalide'),
  animalId: z.string().uuid('Animal invalide'),
  name: z.string().trim().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const deleteDocumentSchema = z.object({
  id: z.string().uuid('ID invalide'),
  animalId: z.string().uuid('Animal invalide'),
});

const getDocumentSchema = z.object({
  id: z.string().uuid('ID invalide'),
  animalId: z.string().uuid('Animal invalide'),
});

function documentsActionError(error: unknown, fallback: string) {
  if (error instanceof DocumentsClientError) {
    return { status: error.status, error: error.message };
  }
  return actionErrorParser(error, fallback);
}

function mapDocument(
  document:
    | Awaited<ReturnType<typeof getDocument>>
    | Awaited<ReturnType<typeof listDocuments>>['items'][number],
): AnimalDocumentListItem {
  const metadata = parseAnimalDocumentMetadata(document.metadata);

  return {
    id: document.id,
    name: document.name,
    content: 'content' in document ? document.content : document.contentPreview,
    contentPreview: 'contentPreview' in document ? document.contentPreview : document.content,
    shelterId: metadata?.shelterId ?? '',
    animalId: metadata?.animalId ?? '',
    templateId: metadata?.templateId ?? null,
    source: metadata?.source ?? 'freeText',
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
  };
}

async function animalExistsInShelter(shelterId: string, animalId: string): Promise<boolean> {
  const animal = await prisma.animal.findFirst({
    where: { id: animalId, shelterId },
    select: { id: true },
  });
  return Boolean(animal);
}

export async function listAnimalDocuments(shelterSlug: string, animalId: string) {
  try {
    const auth = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!auth.ok) return auth.response;

    if (!(await animalExistsInShelter(auth.tenant.shelterId, animalId))) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const cookieHeader = await getServerCookieHeader();
    const result = await listDocuments(
      {
        type: ANIMAL_DOCUMENT_TYPE,
        scopeId: auth.tenant.shelterId,
        ownerScope: 'scope',
        metadataAnimalId: animalId,
        pageSize: 50,
      },
      { cookieHeader },
    );

    const items = result.items
      .filter((document) => isAnimalDocumentForAnimal(document, animalId))
      .map(mapDocument)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { status: 200, data: items };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors du chargement des documents de l’animal',
    );
  }
}

export async function getAnimalDocument(
  shelterSlug: string,
  data: { id: string; animalId: string },
) {
  try {
    const validated = getDocumentSchema.parse(data);
    const auth = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!auth.ok) return auth.response;

    if (!(await animalExistsInShelter(auth.tenant.shelterId, validated.animalId))) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const cookieHeader = await getServerCookieHeader();
    const document = await getDocument(validated.id, { cookieHeader });
    const metadata = parseAnimalDocumentMetadata(document.metadata);

    if (
      document.scopeId !== auth.tenant.shelterId ||
      document.type !== ANIMAL_DOCUMENT_TYPE ||
      metadata?.animalId !== validated.animalId
    ) {
      return { status: 404, error: 'Document introuvable' };
    }

    return { status: 200, data: mapDocument(document) };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors du chargement du document');
  }
}

export async function createFreeTextAnimalDocument(
  shelterSlug: string,
  data: {
    animalId: string;
    name: string;
    content: string;
  },
) {
  try {
    const validated = createFreeTextSchema.parse(data);
    const auth = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!auth.ok) return auth.response;

    if (!(await animalExistsInShelter(auth.tenant.shelterId, validated.animalId))) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const cookieHeader = await getServerCookieHeader();
    const document = await createDocument(
      {
        type: ANIMAL_DOCUMENT_TYPE,
        scopeId: auth.tenant.shelterId,
        name: validated.name,
        content: validated.content,
        metadata: buildAnimalDocumentMetadata({
          shelterId: auth.tenant.shelterId,
          animalId: validated.animalId,
          source: 'freeText',
        }),
      },
      { cookieHeader },
    );

    return { status: 201, data: mapDocument(document) };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la création du document');
  }
}

export async function createAnimalDocumentFromTemplate(
  shelterSlug: string,
  data: {
    animalId: string;
    templateId: string;
    name: string;
    content: string;
  },
) {
  try {
    const validated = createFromTemplateSchema.parse(data);
    const auth = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!auth.ok) return auth.response;

    if (!(await animalExistsInShelter(auth.tenant.shelterId, validated.animalId))) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const cookieHeader = await getServerCookieHeader();
    const template = await getTemplate(validated.templateId, { cookieHeader });

    if (
      template.scopeId !== auth.tenant.shelterId ||
      template.type !== ANIMAL_DOCUMENT_TEMPLATE_TYPE ||
      !isShelterAnimalTemplate(template, auth.tenant.shelterId)
    ) {
      return { status: 404, error: 'Modèle introuvable' };
    }

    const document = await createDocument(
      {
        type: ANIMAL_DOCUMENT_TYPE,
        scopeId: auth.tenant.shelterId,
        name: validated.name,
        content: validated.content,
        metadata: buildAnimalDocumentMetadata({
          shelterId: auth.tenant.shelterId,
          animalId: validated.animalId,
          templateId: template.id,
          source: 'template',
        }),
      },
      { cookieHeader },
    );

    return { status: 201, data: mapDocument(document) };
  } catch (error) {
    return documentsActionError(
      error,
      'Erreur lors de la création du document depuis le modèle',
    );
  }
}

export async function updateAnimalDocument(
  shelterSlug: string,
  data: {
    id: string;
    animalId: string;
    name: string;
    content: string;
  },
) {
  try {
    const validated = updateDocumentSchema.parse(data);
    const auth = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!auth.ok) return auth.response;

    if (!(await animalExistsInShelter(auth.tenant.shelterId, validated.animalId))) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const cookieHeader = await getServerCookieHeader();
    const existing = await getDocument(validated.id, { cookieHeader });
    const metadata = parseAnimalDocumentMetadata(existing.metadata);

    if (
      existing.scopeId !== auth.tenant.shelterId ||
      existing.type !== ANIMAL_DOCUMENT_TYPE ||
      metadata?.animalId !== validated.animalId
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
    return documentsActionError(error, 'Erreur lors de la mise à jour du document');
  }
}

export async function deleteAnimalDocument(
  shelterSlug: string,
  data: { id: string; animalId: string },
) {
  try {
    const validated = deleteDocumentSchema.parse(data);
    const auth = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!auth.ok) return auth.response;

    if (!(await animalExistsInShelter(auth.tenant.shelterId, validated.animalId))) {
      return { status: 404, error: 'Animal introuvable' };
    }

    const cookieHeader = await getServerCookieHeader();
    const existing = await getDocument(validated.id, { cookieHeader });
    const metadata = parseAnimalDocumentMetadata(existing.metadata);

    if (
      existing.scopeId !== auth.tenant.shelterId ||
      existing.type !== ANIMAL_DOCUMENT_TYPE ||
      metadata?.animalId !== validated.animalId
    ) {
      return { status: 404, error: 'Document introuvable' };
    }

    await deleteDocument(validated.id, { cookieHeader });
    return { status: 200, data: { success: true } };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la suppression du document');
  }
}
