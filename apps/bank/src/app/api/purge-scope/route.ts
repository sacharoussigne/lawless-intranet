import { jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { requireInternalSecret } from '@/lib/internalAuth';
import { parseJsonBody } from '@/lib/request';
import { purgeScope } from '@/lib/domain';
import { scopeFieldsSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  if (!requireInternalSecret(request)) {
    return errorResponse(request, 'Forbidden', 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(scopeFieldsSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await purgeScope(parsed.data.scopeType, parsed.data.scopeId);
  return jsonResponse(request, result);
}
