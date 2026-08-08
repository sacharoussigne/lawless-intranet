import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { deleteTransaction, updateTransaction } from '@/lib/domain';
import { updateTransactionSchema } from '@/lib/validation';
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
    updateTransactionSchema.omit({ id: true }).extend({
      scopeType: z.string().min(1),
      scopeId: z.string().uuid(),
    }),
    body,
  );
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await updateTransaction({ ...parsed.data, id });
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
  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const result = await deleteTransaction(scope.data.scopeType, scope.data.scopeId, id);
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.data, result.status);
}
