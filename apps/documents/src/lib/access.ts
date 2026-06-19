import type { AccessType } from '@prisma/client';

type AccessRecord = {
  userId: string;
  accessType: AccessType;
};

type OwnableResource = {
  ownerId: string | null;
  createdById?: string;
  accesses: AccessRecord[];
};

type DocumentResource = {
  ownerId: string;
  accesses: AccessRecord[];
};

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

export function documentListWhere(
  userId: string,
  type: string,
  scopeId: string,
  ownerId?: string,
) {
  const base = { type, scopeId };

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
