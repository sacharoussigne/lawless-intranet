import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { createFolder } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { createFolderSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, createFolderSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => createFolder({ scopeType, scopeId }, input, auth.userId), 201);
}
