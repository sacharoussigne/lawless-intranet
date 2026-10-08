import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { moveItems } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { moveItemsSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, moveItemsSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => moveItems({ scopeType, scopeId }, input));
}
