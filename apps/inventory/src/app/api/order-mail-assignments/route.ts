import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  createOrderMailAssignment,
  deleteOrderMailAssignment,
  getOrderMailAssignment,
  listOrderMailAssignments,
  updateOrderMailAssignment,
} from '@/lib/domain/orderMailAssignments';
import {
  deleteByIdSchema,
  orderMailAssignmentSchema,
  orderStatusSchema,
  orderTypeSchema,
  updateOrderMailAssignmentSchema,
} from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const orderType = url.searchParams.get('orderType');
  const orderStatus = url.searchParams.get('orderStatus');
  if (orderType && orderStatus) {
    const typeParsed = orderTypeSchema.safeParse(orderType);
    const statusParsed = orderStatusSchema.safeParse(orderStatus);
    if (!typeParsed.success || !statusParsed.success) {
      return errorResponse(request, 'orderType ou orderStatus invalide', 400);
    }
    return fromDomainResult(
      request,
      await getOrderMailAssignment({
        ...scope.data,
        orderType: typeParsed.data,
        orderStatus: statusParsed.data,
      }),
    );
  }

  return fromDomainResult(
    request,
    await listOrderMailAssignments(scope.data.scopeType, scope.data.scopeId),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(orderMailAssignmentSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createOrderMailAssignment(parsed.data));
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateOrderMailAssignmentSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await updateOrderMailAssignment(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteByIdSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteOrderMailAssignment(parsed.data));
}
