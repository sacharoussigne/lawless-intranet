import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseScopeQuery } from '@/lib/request';
import { listPendingOccurrences } from '@/lib/domain';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const scope = parseScopeQuery(new URL(request.url));
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const occurrences = await listPendingOccurrences(scope.data.scopeType, scope.data.scopeId);
  return jsonResponse(request, occurrences);
}
