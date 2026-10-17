import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { createLink } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { createLinkSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, createLinkSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => createLink({ scopeType, scopeId }, { ...input, createdById: auth.userId }), 201);
}
