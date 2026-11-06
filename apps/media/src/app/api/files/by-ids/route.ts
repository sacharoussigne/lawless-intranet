import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getFilesByIds } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { filesByIdsSchema } from '@/lib/validation';

/** POST (ids in the body, too long for a query): ready files of the scope with preview URLs. */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, filesByIdsSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ids } = body.data;

  return respond(() => getFilesByIds({ scopeType, scopeId }, ids));
}
