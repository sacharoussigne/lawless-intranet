import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { createPlanned, listPlanned } from '@/lib/domain';
import { createPlannedTransactionSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const scope = parseScopeQuery(new URL(request.url));
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const planned = await listPlanned(scope.data.scopeType, scope.data.scopeId);
  return jsonResponse(request, planned);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(createPlannedTransactionSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const planned = await createPlanned(parsed.data);
  return jsonResponse(request, planned, 201);
}
