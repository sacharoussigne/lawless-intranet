import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getFolderTree } from '@/lib/library';
import { parseQuery, respond } from '@/lib/route';
import { scopeFieldsSchema } from '@/lib/validation';

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(request, scopeFieldsSchema);
  if (!query.ok) return query.response;

  return respond(async () => ({ ok: true, data: await getFolderTree(query.data) }));
}
