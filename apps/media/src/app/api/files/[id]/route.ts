import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { deleteFile, updateFile } from '@/lib/library';
import { parseBody, parseQuery, respond, type RouteContext } from '@/lib/route';
import { scopeFieldsSchema, updateFileSchema } from '@/lib/validation';

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = await parseBody(request, updateFileSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => updateFile({ scopeType, scopeId }, id, input));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const query = parseQuery(request, scopeFieldsSchema);
  if (!query.ok) return query.response;

  return respond(() => deleteFile(query.data, id));
}
