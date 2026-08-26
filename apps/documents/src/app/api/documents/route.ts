import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  canReadDocument,
  documentListWhere,
  isScopeSharedDocumentType,
  serializeDates,
  DOCUMENT_INCLUDE,
} from '@/lib/access';
import { createDocumentSchema, listQuerySchema } from '@/lib/validation';

const CONTENT_PREVIEW_LENGTH = 120;

function truncateContentPreview(content: string): string {
  if (content.length <= CONTENT_PREVIEW_LENGTH) {
    return content;
  }
  return `${content.substring(0, CONTENT_PREVIEW_LENGTH)}...`;
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { searchParams } = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    type: searchParams.get('type'),
    scopeId: searchParams.get('scopeId'),
    ownerId: searchParams.get('ownerId') ?? undefined,
    ownerScope: searchParams.get('ownerScope') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    pageSize: searchParams.get('pageSize') ?? undefined,
    nameSearch: searchParams.get('nameSearch') ?? undefined,
    receiverSearch: searchParams.get('receiverSearch') ?? undefined,
    metadataAnimalId: searchParams.get('metadataAnimalId') ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse(request, 'Invalid query parameters', 400);
  }

  const {
    type,
    scopeId,
    ownerId,
    ownerScope,
    page,
    pageSize,
    nameSearch,
    receiverSearch,
    metadataAnimalId,
  } = parsed.data;
  const nameTerm = nameSearch?.trim();
  const receiverTerm = receiverSearch?.trim();
  const documentOwnerScope = ownerScope === 'scope' ? 'scope' : undefined;

  const metadataFilters: Prisma.DocumentWhereInput[] = [];
  if (receiverTerm) {
    metadataFilters.push({
      metadata: {
        path: ['receiver'],
        string_contains: receiverTerm,
      },
    });
  }
  if (metadataAnimalId && isScopeSharedDocumentType(type)) {
    metadataFilters.push({
      metadata: {
        path: ['animalId'],
        equals: metadataAnimalId,
      },
    });
  }

  const where: Prisma.DocumentWhereInput = {
    ...documentListWhere(auth.userId, type, scopeId, ownerId, documentOwnerScope),
    ...(nameTerm
      ? {
          name: {
            contains: nameTerm,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(metadataFilters.length === 1
      ? metadataFilters[0]
      : metadataFilters.length > 1
        ? { AND: metadataFilters }
        : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: DOCUMENT_INCLUDE,
    }),
    prisma.document.count({ where }),
  ]);

  const visibleItems = items
    .filter((item) => canReadDocument(item, auth.userId))
    .map((item) => {
      const serialized = serializeDates(item);
      const { content, ...rest } = serialized;
      return {
        ...rest,
        contentPreview: truncateContentPreview(content),
      };
    });

  return jsonResponse(request, {
    items: visibleItems,
    totalCount,
    page,
    pageSize,
  });
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'Invalid JSON body', 400);
  }

  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, 'Invalid request body', 400);
  }

  const { type, scopeId, name, content, metadata } = parsed.data;

  const document = await prisma.document.create({
    data: {
      type,
      scopeId,
      ownerId: auth.userId,
      name,
      content,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    include: DOCUMENT_INCLUDE,
  });

  return jsonResponse(request, serializeDates(document), 201);
}
