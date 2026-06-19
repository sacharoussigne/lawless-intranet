import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  canWriteDocument,
  serializeDates,
  DOCUMENT_INCLUDE,
} from '@/lib/access';
import { grantAccessSchema } from '@/lib/validation';

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

  if (!document || !canWriteDocument(document, auth.userId)) {
    return errorResponse(request, 'Document not found', 404);
  }

  return jsonResponse(
    request,
    document.accesses.map((access) => serializeDates(access)),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: DOCUMENT_INCLUDE,
  });

  if (!document || !canWriteDocument(document, auth.userId)) {
    return errorResponse(request, 'Document not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'Invalid JSON body', 400);
  }

  const parsed = grantAccessSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, 'Invalid request body', 400);
  }

  if (parsed.data.userId === document.ownerId) {
    return errorResponse(request, 'Owner already has full access', 400);
  }

  const access = await prisma.documentAccess.upsert({
    where: {
      documentId_userId: {
        documentId: id,
        userId: parsed.data.userId,
      },
    },
    create: {
      documentId: id,
      userId: parsed.data.userId,
      accessType: parsed.data.accessType,
    },
    update: {
      accessType: parsed.data.accessType,
    },
  });

  return jsonResponse(request, serializeDates(access), 201);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return errorResponse(request, 'userId query parameter is required', 400);
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: DOCUMENT_INCLUDE,
  });

  if (!document || !canWriteDocument(document, auth.userId)) {
    return errorResponse(request, 'Document not found', 404);
  }

  await prisma.documentAccess.deleteMany({
    where: {
      documentId: id,
      userId,
    },
  });

  return jsonResponse(request, { success: true });
}
