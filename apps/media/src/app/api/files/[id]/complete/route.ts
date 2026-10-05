import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { completeUpload } from '@/lib/library';
import { parseBody, respond, type RouteContext } from '@/lib/route';
import { scopeFieldsSchema } from '@/lib/validation';

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const body = await parseBody(request, scopeFieldsSchema);
  if (!body.ok) return body.response;

  return respond(() => completeUpload(body.data, id));
}
