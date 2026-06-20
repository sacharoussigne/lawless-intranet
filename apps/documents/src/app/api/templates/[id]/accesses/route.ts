import { NextResponse } from 'next/server';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  canWriteTemplate,
  serializeDates,
  TEMPLATE_INCLUDE,
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

  const template = await prisma.template.findUnique({
    where: { id },
    include: TEMPLATE_INCLUDE,
  });

  if (!template || !canWriteTemplate(template, auth.userId)) {
    return errorResponse(request, 'Template not found', 404);
  }

  return jsonResponse(
    request,
    template.accesses.map((access) => serializeDates(access)),
  );
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const template = await prisma.template.findUnique({
    where: { id },
    include: TEMPLATE_INCLUDE,
  });

  if (!template || !canWriteTemplate(template, auth.userId)) {
    return errorResponse(request, 'Template not found', 404);
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

  if (parsed.data.userId === template.ownerId) {
    return errorResponse(request, 'Owner already has full access', 400);
  }

  const access = await prisma.templateAccess.upsert({
    where: {
      templateId_userId: {
        templateId: id,
        userId: parsed.data.userId,
      },
    },
    create: {
      templateId: id,
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

  const template = await prisma.template.findUnique({
    where: { id },
    include: TEMPLATE_INCLUDE,
  });

  if (!template || !canWriteTemplate(template, auth.userId)) {
    return errorResponse(request, 'Template not found', 404);
  }

  await prisma.templateAccess.deleteMany({
    where: {
      templateId: id,
      userId,
    },
  });

  return jsonResponse(request, { success: true });
}
