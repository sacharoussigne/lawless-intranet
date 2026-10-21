import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { duplicateOrder } from '@/lib/domain/orders';
import { duplicateOrderSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(duplicateOrderSchema, { ...(body ?? {}), id });
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  return fromDomainResult(
    request,
    await duplicateOrder({ ...parsed.data, actorUserId: auth.userId }),
  );
}
