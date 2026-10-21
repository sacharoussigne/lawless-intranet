import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { addOrderComment, listOrderEvents } from '@/lib/domain/orders';
import { createOrderCommentSchema, idSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

/** Chatter of the order (comments and recorded changes), newest first. */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const scope = parseScopeQuery(new URL(request.url));
  if (!scope.ok) return errorResponse(request, scope.error, 400);
  const { id } = await context.params;
  const orderId = idSchema.safeParse(id);
  if (!orderId.success) return errorResponse(request, 'ID invalide', 400);

  return fromDomainResult(request, await listOrderEvents({ ...scope.data, orderId: orderId.data }));
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(createOrderCommentSchema, { ...(body ?? {}), orderId: id });
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  return fromDomainResult(
    request,
    await addOrderComment({ ...parsed.data, actorUserId: auth.userId }),
  );
}
