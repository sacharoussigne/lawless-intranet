import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseScopeQuery } from '@/lib/request';
import { deleteDescriptionSuggestion } from '@/lib/domain';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ value: string }> },
) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { value } = await context.params;
  const scope = parseScopeQuery(new URL(request.url));
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const result = await deleteDescriptionSuggestion(
    scope.data.scopeType,
    scope.data.scopeId,
    decodeURIComponent(value),
  );
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.data);
}
