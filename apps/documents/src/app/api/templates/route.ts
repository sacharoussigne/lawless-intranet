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
  canReadTemplate,
  canWriteTemplate,
  serializeDates,
  templateListWhere,
  TEMPLATE_INCLUDE,
} from '@/lib/access';
import {
  createTemplateSchema,
  listQuerySchema,
  parseOwnerIdFilter,
} from '@/lib/validation';

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
  });

  if (!parsed.success) {
    return errorResponse(request, 'Invalid query parameters', 400);
  }

  const { type, scopeId, ownerId, ownerScope, page, pageSize, nameSearch } =
    parsed.data;
  const ownerFilter = parseOwnerIdFilter(ownerId, ownerScope, auth.userId);
  const nameTerm = nameSearch?.trim();

  const where = {
    ...templateListWhere(auth.userId, type, scopeId, ownerFilter),
    ...(nameTerm
      ? {
          name: {
            contains: nameTerm,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.template.findMany({
      where,
      orderBy: ownerFilter === null ? { createdAt: 'desc' } : { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: TEMPLATE_INCLUDE,
    }),
    prisma.template.count({ where }),
  ]);

  const visibleItems = items
    .filter((item) => canReadTemplate(item, auth.userId))
    .map(serializeDates);

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

  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, 'Invalid request body', 400);
  }

  const { type, scopeId, ownerId, name, description, content, metadata } =
    parsed.data;

  const template = await prisma.template.create({
    data: {
      type,
      scopeId,
      ownerId: ownerId === undefined ? auth.userId : ownerId,
      createdById: auth.userId,
      name,
      description,
      content,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    include: TEMPLATE_INCLUDE,
  });

  return jsonResponse(request, serializeDates(template), 201);
}
