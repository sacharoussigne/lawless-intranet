import { requireInternal } from '@/lib/auth';
import { purgeScope } from '@/lib/library';
import { parseBody, respond } from '@/lib/route';
import { scopeFieldsSchema } from '@/lib/validation';

/** Host-only: deletes all folders, files and S3 objects of a tenant. */
export async function POST(request: Request) {
  const forbidden = requireInternal(request);
  if (forbidden) return forbidden;

  const body = await parseBody(request, scopeFieldsSchema);
  if (!body.ok) return body.response;

  return respond(async () => ({ ok: true, data: await purgeScope(body.data) }));
}
