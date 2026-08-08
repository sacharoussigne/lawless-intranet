import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  createOrder,
  deleteOrder,
  getActiveOrdersForCompanyGroup,
  getOrderById,
  listOrdersPage,
  updateOrder,
} from '@/lib/domain/orders';
import {
  createOrderSchema,
  deleteByIdSchema,
  updateOrderSchema,
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

  const id = url.searchParams.get('id');
  if (id) {
    return fromDomainResult(
      request,
      await getOrderById({ ...scope.data, id }),
    );
  }

  const companyGroupId = url.searchParams.get('activeForCompanyGroupId');
  if (companyGroupId) {
    return fromDomainResult(
      request,
      await getActiveOrdersForCompanyGroup({ ...scope.data, companyGroupId }),
    );
  }

  const statusParam = url.searchParams.getAll('status');
  const statuses = statusParam.length
    ? statusParam.flatMap((s) => s.split(',')).filter(Boolean)
    : undefined;

  return fromDomainResult(
    request,
    await listOrdersPage({
      ...scope.data,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 10),
      status: statuses as never,
      type: (url.searchParams.get('type') as never) ?? null,
      search: url.searchParams.get('search') ?? undefined,
      createdAtFrom: url.searchParams.get('createdAtFrom'),
      createdAtTo: url.searchParams.get('createdAtTo'),
    }),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(createOrderSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createOrder(parsed.data));
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateOrderSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  if ((body as { status?: string } | null)?.status === 'COMPLETED') {
    return errorResponse(request, 'Utilisez completeOrder pour terminer une commande', 400);
  }
  return fromDomainResult(request, await updateOrder(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteByIdSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteOrder(parsed.data));
}
