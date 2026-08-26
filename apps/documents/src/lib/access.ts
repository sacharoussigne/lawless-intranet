import type { AccessType } from '@prisma/client';

type AccessRecord = {
  userId: string;
  accessType: AccessType;
};

type OwnableResource = {
  ownerId: string | null;
  createdById?: string;
  type?: string;
  accesses: AccessRecord[];
};

type DocumentResource = {
  type: string;
  ownerId: string;
  accesses: AccessRecord[];
};

export const SCOPE_SHARED_DOCUMENT_TYPES = new Set(['animal-document']);

export function isScopeSharedDocumentType(type: string): boolean {
  return SCOPE_SHARED_DOCUMENT_TYPES.has(type);
}

export function canReadTemplate(
  template: OwnableResource,
  userId: string,
): boolean {
  if (canWriteTemplate(template, userId)) {
    return true;
  }

  if (template.ownerId === null) {
    return true;
  }

  return template.accesses.some(
    (access) => access.userId === userId && access.accessType === 'READ',
  );
}

export function canWriteTemplate(
  template: OwnableResource,
  userId: string,
): boolean {
  if (template.type === 'order' && template.ownerId === null) {
    return true;
  }

  if (template.ownerId === userId) {
    return true;
  }

  if (template.ownerId === null && template.createdById === userId) {
    return true;
  }

  return template.accesses.some(
    (access) => access.userId === userId && access.accessType === 'WRITE',
  );
}

export function canReadDocument(
  document: DocumentResource,
  userId: string,
): boolean {
  if (isScopeSharedDocumentType(document.type)) {
    return true;
  }

  if (canWriteDocument(document, userId)) {
    return true;
  }

  return document.accesses.some(
    (access) => access.userId === userId && access.accessType === 'READ',
  );
}

export function canWriteDocument(
  document: DocumentResource,
  userId: string,
): boolean {
  if (isScopeSharedDocumentType(document.type)) {
    return true;
  }

  if (document.ownerId === userId) {
    return true;
  }

  return document.accesses.some(
    (access) => access.userId === userId && access.accessType === 'WRITE',
  );
}

export function templateListWhere(
  userId: string,
  type: string,
  scopeId: string,
  ownerId?: string | null,
  ownerScope?: 'org' | 'personal' | 'all' | 'accessible',
) {
  const base = { type, scopeId };

  if (ownerScope === 'accessible') {
    return {
      ...base,
      OR: [
        { ownerId: userId },
        { accesses: { some: { userId } } },
      ],
    };
  }

  if (ownerId === null) {
    return { ...base, ownerId: null };
  }

  if (typeof ownerId === 'string') {
    return { ...base, ownerId };
  }

  return {
    ...base,
    OR: [
      { ownerId: userId },
      { ownerId: null },
      { accesses: { some: { userId } } },
    ],
  };
}

const IMPOSSIBLE_DOCUMENT_ID = '00000000-0000-0000-0000-000000000000';

export function documentListWhere(
  userId: string,
  type: string,
  scopeId: string,
  ownerId?: string,
  ownerScope?: 'scope',
) {
  const base = { type, scopeId };

  if (ownerScope === 'scope') {
    if (!isScopeSharedDocumentType(type)) {
      return { ...base, id: IMPOSSIBLE_DOCUMENT_ID };
    }
    return base;
  }

  if (ownerId) {
    return { ...base, ownerId };
  }

  return {
    ...base,
    OR: [
      { ownerId: userId },
      { accesses: { some: { userId } } },
    ],
  };
}

const TEMPLATE_INCLUDE = {
  accesses: {
    select: {
      id: true,
      userId: true,
      accessType: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const DOCUMENT_INCLUDE = {
  accesses: {
    select: {
      id: true,
      userId: true,
      accessType: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

export { TEMPLATE_INCLUDE, DOCUMENT_INCLUDE };

export function serializeDates<T extends { createdAt: Date; updatedAt: Date }>(
  record: T,
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string } {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
