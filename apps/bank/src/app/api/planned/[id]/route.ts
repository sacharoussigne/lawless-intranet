import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { deletePlanned, updatePlanned } from '@/lib/domain';
import { updatePlannedTransactionSchema } from '@/lib/validation';
import { z } from 'zod';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(
    updatePlannedTransactionSchema.omit({ id: true }).extend({
      scopeType: z.string().min(1),
      scopeId: z.string().uuid(),
    }),
    body,
  );
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await updatePlanned({ ...parsed.data, id });
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.data, result.status);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const scope = parseScopeQuery(new URL(request.url));
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const result = await deletePlanned(scope.data.scopeType, scope.data.scopeId, id);
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.data, result.status);
}
