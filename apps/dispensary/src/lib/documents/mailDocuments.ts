import type {
  DocumentRecord,
  MailDocumentMetadata,
  MailTemplateMetadata,
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
