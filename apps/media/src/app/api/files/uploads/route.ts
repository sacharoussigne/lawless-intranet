import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { createUpload } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { createUploadSchema } from '@/lib/validation';

/** Issues a presigned POST: the browser then uploads straight to S3. */
export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request, createUploadSchema);
  if (!body.ok) return body.response;
  const { scopeType, scopeId, ...input } = body.data;

  return respond(() => createUpload({ scopeType, scopeId }, input, auth.userId), 201);
}
