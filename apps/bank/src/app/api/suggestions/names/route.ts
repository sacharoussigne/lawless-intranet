import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { addNameSuggestion, getNameSuggestions } from '@/lib/domain';
import { scopeFieldsSchema } from '@/lib/validation';
import { z } from 'zod';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const scope = parseScopeQuery(new URL(request.url));
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const data = await getNameSuggestions(scope.data.scopeType, scope.data.scopeId);
  return jsonResponse(request, data);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(
    scopeFieldsSchema.extend({ value: z.string().min(1) }),
    body,
  );
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await addNameSuggestion(
    parsed.data.scopeType,
    parsed.data.scopeId,
    parsed.data.value,
  );
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.data, result.status);
}
