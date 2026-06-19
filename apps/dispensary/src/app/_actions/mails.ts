'use server';

import { z } from 'zod/v3';
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from '@lawless-intranet/documents-client/server';
import { DocumentsClientError } from '@lawless-intranet/documents-client';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import {
  buildMailDocumentMetadata,
  documentToMail,
  getMailReceiver,
  getServerCookieHeader,
  MAIL_DOCUMENT_TYPE,
} from '@/lib/documents/mailDocuments';

const createMailSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  receiver: z.string().min(1, 'Le destinataire est requis').max(255, 'Le destinataire est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const updateMailSchema = z.object({
  id: z.string().uuid('ID invalide'),
  name: z.string().min(1, 'Le nom est requis').max(255, 'Le nom est trop long'),
  receiver: z.string().min(1, 'Le destinataire est requis').max(255, 'Le destinataire est trop long'),
  content: z.string().min(1, 'Le contenu est requis'),
});

const deleteMailSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

const getMailsPageSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  nameSearch: z.string().max(255).optional(),
  receiverSearch: z.string().max(255).optional(),
});

const getMailByIdSchema = z.object({
  id: z.string().uuid('ID invalide'),
});

function documentsActionError(error: unknown, fallback: string) {
  if (error instanceof DocumentsClientError) {
    return {
      status: error.status,
      error: error.message,
    };
  }
  return actionErrorParser(error, fallback);
}

export async function createMail(
  dispensarySlug: string,
  data: {
    name: string;
    receiver: string;
    content: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const validatedData = createMailSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const document = await createDocument(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        name: validatedData.name,
        content: validatedData.content,
        metadata: buildMailDocumentMetadata(validatedData.receiver),
      },
      { cookieHeader },
    );

    return {
      status: 201,
      data: documentToMail(document),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la création du courrier');
  }
}

export async function getMailsPage(
  dispensarySlug: string,
  params: {
    page?: number;
    pageSize?: number;
    nameSearch?: string;
    receiverSearch?: string;
  } = {},
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const { page, pageSize, nameSearch, receiverSearch } =
      getMailsPageSchema.parse(params);
    const cookieHeader = await getServerCookieHeader();

    const result = await listDocuments(
      {
        type: MAIL_DOCUMENT_TYPE,
        scopeId: dispensaryId,
        ownerId: ctx.session.user.id,
        page,
        pageSize,
        nameSearch,
        receiverSearch,
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          name: item.name,
          receiver: getMailReceiver(item.metadata),
          createdAt: new Date(item.createdAt),
          contentPreview: item.contentPreview,
        })),
        totalCount: result.totalCount,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération des courriers');
  }
}

export async function getMailById(
  dispensarySlug: string,
  data: { id: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const { id } = getMailByIdSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const document = await getDocument(id, { cookieHeader });

    return {
      status: 200,
      data: documentToMail(document),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la récupération du courrier');
  }
}

export async function updateMail(
  dispensarySlug: string,
  data: {
    id: string;
    name: string;
    receiver: string;
    content: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const validatedData = updateMailSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    const document = await updateDocument(
      validatedData.id,
      {
        name: validatedData.name,
        content: validatedData.content,
        metadata: buildMailDocumentMetadata(validatedData.receiver),
      },
      { cookieHeader },
    );

    return {
      status: 200,
      data: documentToMail(document),
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la modification du courrier');
  }
}

export async function deleteMail(dispensarySlug: string, data: { id: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, {
      feature: 'mails',
    });
    if (!ctx.ok) return ctx.response;

    const validatedData = deleteMailSchema.parse(data);
    const cookieHeader = await getServerCookieHeader();

    await deleteDocument(validatedData.id, { cookieHeader });

    return {
      status: 200,
      data: { success: true },
    };
  } catch (error) {
    return documentsActionError(error, 'Erreur lors de la suppression du courrier');
  }
}
