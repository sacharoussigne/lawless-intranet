import type {
  DocumentAccessType,
  DocumentRecord,
  MailDocumentMetadata,
  MailTemplateMetadata,
  ResourceAccess,
  TemplateRecord,
} from '@lawless-intranet/types';

export const MAIL_DOCUMENT_TYPE = 'mail';

export async function getServerCookieHeader(): Promise<string | null> {
  const { headers } = await import('next/headers');
  return (await headers()).get('cookie');
}

export function getMailReceiver(
  metadata: MailDocumentMetadata | Record<string, unknown> | null | undefined,
): string {
  if (metadata && typeof metadata === 'object' && 'receiver' in metadata) {
    const receiver = metadata.receiver;
    return typeof receiver === 'string' ? receiver : '';
  }
  return '';
}

export function getDefaultMailName(
  metadata: MailTemplateMetadata | Record<string, unknown> | null | undefined,
): string | null {
  if (metadata && typeof metadata === 'object' && 'defaultDocumentName' in metadata) {
    const value = metadata.defaultDocumentName;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

export function templateToMailTemplate(template: TemplateRecord) {
  return {
    id: template.id,
    dispensaryId: template.scopeId,
    name: template.name,
    description: template.description,
    content: template.content,
    defaultMailName: getDefaultMailName(template.metadata),
    userId: template.ownerId,
    createdAt: new Date(template.createdAt),
    updatedAt: new Date(template.updatedAt),
  };
}

export function documentToMail(document: DocumentRecord) {
  return {
    id: document.id,
    dispensaryId: document.scopeId,
    senderId: document.ownerId,
    name: document.name,
    receiver: getMailReceiver(document.metadata),
    content: document.content,
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
  };
}

export function buildMailDocumentMetadata(receiver: string): MailDocumentMetadata {
  return { receiver };
}

export function buildMailTemplateMetadata(
  defaultMailName?: string,
): MailTemplateMetadata | undefined {
  if (!defaultMailName) {
    return undefined;
  }
  return { defaultDocumentName: defaultMailName };
}

export type MailResourceAccessMeta = {
  ownerId: string | null;
  isOwner: boolean;
  isSharedWithMe: boolean;
  isSharedByMe: boolean;
  accessType: DocumentAccessType | null;
  canWrite: boolean;
};

function resolveResourceAccess(
  ownerId: string | null,
  accesses: ResourceAccess[] | undefined,
  currentUserId: string,
): MailResourceAccessMeta {
  const isOwner = ownerId === currentUserId;
  const sharedAccess = accesses?.find((access) => access.userId === currentUserId);
  const isSharedWithMe = !isOwner && Boolean(sharedAccess);
  const isSharedByMe = isOwner && (accesses?.length ?? 0) > 0;
  const accessType = isOwner ? null : (sharedAccess?.accessType ?? null);
  const canWrite = isOwner || sharedAccess?.accessType === 'WRITE';

  return {
    ownerId,
    isOwner,
    isSharedWithMe,
    isSharedByMe,
    accessType,
    canWrite,
  };
}

export function resolveMailTemplateAccess(
  template: Pick<TemplateRecord, 'ownerId' | 'accesses'>,
  currentUserId: string,
): MailResourceAccessMeta {
  return resolveResourceAccess(template.ownerId, template.accesses, currentUserId);
}

export function resolveMailDocumentAccess(
  document: Pick<DocumentRecord, 'ownerId' | 'accesses'>,
  currentUserId: string,
): MailResourceAccessMeta {
  return resolveResourceAccess(document.ownerId, document.accesses, currentUserId);
}

export async function attachOwnerNames<T extends { ownerId?: string | null }>(
  items: T[],
): Promise<Array<T & { ownerName: string | null }>> {
  const { fetchUserProfiles } = await import('@/lib/authUsers');
  const ownerIds = [
    ...new Set(items.map((item) => item.ownerId).filter((id): id is string => Boolean(id))),
  ];

  const profiles =
    ownerIds.length > 0 ? await fetchUserProfiles(ownerIds) : new Map<string, { name: string }>();

  return items.map((item) => ({
    ...item,
    ownerName: item.ownerId ? (profiles.get(item.ownerId)?.name ?? null) : null,
  }));
}
