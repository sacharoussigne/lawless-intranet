import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { getFolderContents } from '@/lib/library';
import { parseQuery, respond } from '@/lib/route';
import { folderContentsQuerySchema } from '@/lib/validation';

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;

  const query = parseQuery(request, folderContentsQuerySchema);
  if (!query.ok) return query.response;
  const { folderId, ...scope } = query.data;

  return respond(() => getFolderContents(scope, folderId ?? null));
}
