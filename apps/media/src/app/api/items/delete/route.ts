import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { deleteItems } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { deleteItemsSchema } from '@/lib/validation';

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, deleteItemsSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => deleteItems({ scopeType, scopeId }, input));
}
