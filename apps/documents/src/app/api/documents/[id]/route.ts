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
  canWriteDocument,
  serializeDates,
  DOCUMENT_INCLUDE,
} from '@/lib/access';
import { updateDocumentSchema } from '@/lib/validation';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: DOCUMENT_INCLUDE,
  });

  if (!document || !canReadDocument(document, auth.userId)) {
    return errorResponse(request, 'Document not found', 404);
  }

  return jsonResponse(request, serializeDates(document));
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const existing = await prisma.document.findUnique({
    where: { id },
    include: DOCUMENT_INCLUDE,
  });

  if (!existing || !canWriteDocument(existing, auth.userId)) {
    return errorResponse(request, 'Document not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'Invalid JSON body', 400);
  }

  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, 'Invalid request body', 400);
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
      ...(parsed.data.metadata !== undefined
        ? {
            metadata: parsed.data.metadata as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
          }
        : {}),
    },
    include: DOCUMENT_INCLUDE,
  });

  return jsonResponse(request, serializeDates(document));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const existing = await prisma.document.findUnique({
    where: { id },
    include: DOCUMENT_INCLUDE,
  });

  if (!existing || !canWriteDocument(existing, auth.userId)) {
    return errorResponse(request, 'Document not found', 404);
  }

  await prisma.document.delete({ where: { id } });

  return jsonResponse(request, { success: true });
}
