import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { shareFile, unshareFile } from '@/lib/library';
import { parseBody, parseQuery, respond, type RouteContext } from '@/lib/route';
import { scopeFieldsSchema } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = await parseBody(request, scopeFieldsSchema);
  if (!body.ok) return body.response;

  return respond(() => shareFile(body.data, id));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const query = parseQuery(request, scopeFieldsSchema);
  if (!query.ok) return query.response;

  return respond(() => unshareFile(query.data, id));
}
