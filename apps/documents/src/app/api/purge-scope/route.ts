import { NextResponse } from 'next/server';
import { z } from 'zod';
import { corsPreflightResponse } from '@/lib/cors';
import {
  errorResponse,
  jsonResponse,
  requireSession,
} from '@/lib/auth';
import prisma from '@/lib/prisma';

const purgeScopeSchema = z.object({
  scopeId: z.string().min(1),
});

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function DELETE(request: Request) {
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

  const parsed = purgeScopeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(request, 'Invalid request body', 400);
  }

  const { scopeId } = parsed.data;

  const [templates, documents] = await prisma.$transaction([
    prisma.template.deleteMany({ where: { scopeId } }),
    prisma.document.deleteMany({ where: { scopeId } }),
  ]);

  return jsonResponse(request, {
    success: true as const,
    deletedTemplates: templates.count,
    deletedDocuments: documents.count,
  });
}
