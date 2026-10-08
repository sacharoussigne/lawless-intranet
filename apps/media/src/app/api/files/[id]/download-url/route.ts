import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/library';
import { parseQuery, respond, type RouteContext } from '@/lib/route';
import { scopeFieldsSchema } from '@/lib/validation';

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const query = parseQuery(request, scopeFieldsSchema);
  if (!query.ok) return query.response;

  return respond(() => getDownloadUrl(query.data, id));
}
