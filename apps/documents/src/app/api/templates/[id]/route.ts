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
  TEMPLATE_INCLUDE,
} from '@/lib/access';
import { updateTemplateSchema } from '@/lib/validation';

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

  if (!template || !canReadTemplate(template, auth.userId)) {
    return errorResponse(request, 'Template not found', 404);
  }

  return jsonResponse(request, serializeDates(template));
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const existing = await prisma.template.findUnique({
    where: { id },
    include: TEMPLATE_INCLUDE,
  });

  if (!existing || !canWriteTemplate(existing, auth.userId)) {
    return errorResponse(request, 'Template not found', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, 'Invalid JSON body', 400);
  }

  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, 'Invalid request body', 400);
  }

  const template = await prisma.template.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
      ...(parsed.data.metadata !== undefined
        ? {
            metadata: parsed.data.metadata as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
          }
        : {}),
    },
    include: TEMPLATE_INCLUDE,
  });

  return jsonResponse(request, serializeDates(template));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;

  const existing = await prisma.template.findUnique({
    where: { id },
    include: TEMPLATE_INCLUDE,
  });

  if (!existing || !canWriteTemplate(existing, auth.userId)) {
    return errorResponse(request, 'Template not found', 404);
  }

  await prisma.template.delete({ where: { id } });

  return jsonResponse(request, { success: true });
}
