import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { deleteOrderComment, updateOrderComment } from '@/lib/domain/orders';
import { deleteOrderCommentSchema, updateOrderCommentSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string; eventId: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id, eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateOrderCommentSchema, { ...(body ?? {}), orderId: id, eventId });
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  return fromDomainResult(
    request,
    await updateOrderComment({ ...parsed.data, actorUserId: auth.userId }),
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id, eventId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteOrderCommentSchema, { ...(body ?? {}), orderId: id, eventId });
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  return fromDomainResult(
    request,
    await deleteOrderComment({ ...parsed.data, actorUserId: auth.userId }),
  );
}
