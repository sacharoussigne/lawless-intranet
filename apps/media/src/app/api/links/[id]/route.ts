import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { deleteLink, updateLink } from '@/lib/library';
import { parseBody, parseQuery, respond, type RouteContext } from '@/lib/route';
import { scopeFieldsSchema, updateLinkSchema } from '@/lib/validation';

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = await parseBody(request, updateLinkSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => updateLink({ scopeType, scopeId }, id, input));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const query = parseQuery(request, scopeFieldsSchema);
  if (!query.ok) return query.response;

  return respond(() => deleteLink(query.data, id));
}
