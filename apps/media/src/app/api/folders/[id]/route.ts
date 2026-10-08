import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { deleteFolder, updateFolder } from '@/lib/library';
import { parseBody, parseQuery, respond, type RouteContext } from '@/lib/route';
import { scopeFieldsSchema, updateFolderSchema } from '@/lib/validation';

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = await parseBody(request, updateFolderSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => updateFolder({ scopeType, scopeId }, id, input));
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const query = parseQuery(request, scopeFieldsSchema);
  if (!query.ok) return query.response;

  return respond(() => deleteFolder(query.data, id));
}
