import type {
  DocumentAccessType,
  DocumentListItem,
  DocumentRecord,
  PaginatedResponse,
  ResourceAccess,
  TemplateRecord,
} from '@lawless-intranet/types';
import {
  documentsFetch,
  type DocumentsFetchOptions,
  parseJsonResponse,
} from './config';

type ClientOptions = Pick<DocumentsFetchOptions, 'cookieHeader'>;

export type ListTemplatesParams = {
  type: string;
  scopeId: string;
  ownerId?: string;
  ownerScope?: 'org' | 'personal' | 'all';
  page?: number;
  pageSize?: number;
  nameSearch?: string;
};

export type CreateTemplateInput = {
  type: string;
  scopeId: string;
  ownerId?: string | null;
  name: string;
  description?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type UpdateTemplateInput = {
  name?: string;
  description?: string | null;
  content?: string;
  metadata?: Record<string, unknown> | null;
};

export type ListDocumentsParams = {
  type: string;
  scopeId: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
  nameSearch?: string;
  receiverSearch?: string;
};

export type CreateDocumentInput = {
  type: string;
  scopeId: string;
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type UpdateDocumentInput = {
  name?: string;
  content?: string;
  metadata?: Record<string, unknown> | null;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listTemplates(
  params: ListTemplatesParams,
  options: ClientOptions = {},
): Promise<PaginatedResponse<TemplateRecord>> {
  const response = await documentsFetch(
    `/api/templates${toQuery({
      type: params.type,
      scopeId: params.scopeId,
      ownerId: params.ownerId,
      ownerScope: params.ownerScope,
      page: params.page,
      pageSize: params.pageSize,
      nameSearch: params.nameSearch,
    })}`,
    { cookieHeader: options.cookieHeader },
  );

  return parseJsonResponse(response);
}

export async function createTemplate(
  input: CreateTemplateInput,
  options: ClientOptions = {},
): Promise<TemplateRecord> {
  const response = await documentsFetch('/api/templates', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });

  return parseJsonResponse(response);
}

export async function getTemplate(
  id: string,
  options: ClientOptions = {},
): Promise<TemplateRecord> {
  const response = await documentsFetch(`/api/templates/${encodeURIComponent(id)}`, {
    cookieHeader: options.cookieHeader,
  });

  return parseJsonResponse(response);
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  options: ClientOptions = {},
): Promise<TemplateRecord> {
  const response = await documentsFetch(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });

  return parseJsonResponse(response);
}

export async function deleteTemplate(
  id: string,
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await documentsFetch(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
  });

  return parseJsonResponse(response);
}

export async function listTemplateAccesses(
  templateId: string,
  options: ClientOptions = {},
): Promise<ResourceAccess[]> {
  const response = await documentsFetch(
    `/api/templates/${encodeURIComponent(templateId)}/accesses`,
    { cookieHeader: options.cookieHeader },
  );

  return parseJsonResponse(response);
}

export async function grantTemplateAccess(
  templateId: string,
  userId: string,
  accessType: DocumentAccessType,
  options: ClientOptions = {},
): Promise<ResourceAccess> {
  const response = await documentsFetch(
    `/api/templates/${encodeURIComponent(templateId)}/accesses`,
    {
      method: 'POST',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ userId, accessType }),
    },
  );

  return parseJsonResponse(response);
}

export async function revokeTemplateAccess(
  templateId: string,
  userId: string,
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await documentsFetch(
    `/api/templates/${encodeURIComponent(templateId)}/accesses${toQuery({ userId })}`,
    {
      method: 'DELETE',
      cookieHeader: options.cookieHeader,
    },
  );

  return parseJsonResponse(response);
}

export async function listDocuments(
  params: ListDocumentsParams,
  options: ClientOptions = {},
): Promise<PaginatedResponse<DocumentListItem>> {
  const response = await documentsFetch(
    `/api/documents${toQuery({
      type: params.type,
      scopeId: params.scopeId,
      ownerId: params.ownerId,
      page: params.page,
      pageSize: params.pageSize,
      nameSearch: params.nameSearch,
      receiverSearch: params.receiverSearch,
    })}`,
    { cookieHeader: options.cookieHeader },
  );

  return parseJsonResponse(response);
}

export async function createDocument(
  input: CreateDocumentInput,
  options: ClientOptions = {},
): Promise<DocumentRecord> {
  const response = await documentsFetch('/api/documents', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });

  return parseJsonResponse(response);
}

export async function getDocument(
  id: string,
  options: ClientOptions = {},
): Promise<DocumentRecord> {
  const response = await documentsFetch(`/api/documents/${encodeURIComponent(id)}`, {
    cookieHeader: options.cookieHeader,
  });

  return parseJsonResponse(response);
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  options: ClientOptions = {},
): Promise<DocumentRecord> {
  const response = await documentsFetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });

  return parseJsonResponse(response);
}

export async function deleteDocument(
  id: string,
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await documentsFetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
  });

  return parseJsonResponse(response);
}

export async function listDocumentAccesses(
  documentId: string,
  options: ClientOptions = {},
): Promise<ResourceAccess[]> {
  const response = await documentsFetch(
    `/api/documents/${encodeURIComponent(documentId)}/accesses`,
    { cookieHeader: options.cookieHeader },
  );

  return parseJsonResponse(response);
}

export async function grantDocumentAccess(
  documentId: string,
  userId: string,
  accessType: DocumentAccessType,
  options: ClientOptions = {},
): Promise<ResourceAccess> {
  const response = await documentsFetch(
    `/api/documents/${encodeURIComponent(documentId)}/accesses`,
    {
      method: 'POST',
      cookieHeader: options.cookieHeader,
      body: JSON.stringify({ userId, accessType }),
    },
  );

  return parseJsonResponse(response);
}

export async function revokeDocumentAccess(
  documentId: string,
  userId: string,
  options: ClientOptions = {},
): Promise<{ success: true }> {
  const response = await documentsFetch(
    `/api/documents/${encodeURIComponent(documentId)}/accesses${toQuery({ userId })}`,
    {
      method: 'DELETE',
      cookieHeader: options.cookieHeader,
    },
  );

  return parseJsonResponse(response);
}
