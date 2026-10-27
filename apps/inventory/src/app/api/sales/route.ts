import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { requireInternalSecret } from '@/lib/internalAuth';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  cancelSale,
  createSale,
  deleteSale,
  depositSale,
  getSellableItems,
  listWeeklySales,
} from '@/lib/domain/sales';
import { createSaleSchema, saleActionSchema } from '@/lib/validation';
import { parseISO } from 'date-fns';

/** Host-only: the rights in the request (canViewAll, canEditPastWeeks...) come from the intranet. */
export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  if (!requireInternalSecret(request)) return errorResponse(request, 'Forbidden', 403);
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  if (url.searchParams.get('sellable') === 'true') {
    return fromDomainResult(
      request,
      await getSellableItems(scope.data.scopeType, scope.data.scopeId),
    );
  }

  const weekDateParam = url.searchParams.get('weekDate');
  return fromDomainResult(
    request,
    await listWeeklySales({
      ...scope.data,
      userId: auth.userId,
      canViewAll: url.searchParams.get('canViewAll') === 'true',
      weekDate: weekDateParam ? parseISO(weekDateParam) : undefined,
    }),
  );
}

export async function POST(request: Request) {
  if (!requireInternalSecret(request)) return errorResponse(request, 'Forbidden', 403);
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const action = (body as { action?: string } | null)?.action;

  if (action === 'cancel' || action === 'deposit' || action === 'delete') {
    const parsed = parseJsonBody(saleActionSchema, body);
    if (!parsed.ok) return errorResponse(request, parsed.error, 400);

    let result;
    if (action === 'cancel') {
      result = await cancelSale({
        ...parsed.data,
        userId: auth.userId,
        canViewAll: parsed.data.canViewAll,
        canEditPastWeeks: parsed.data.canEditPastWeeks,
      });
    } else if (action === 'deposit') {
      result = await depositSale({
        ...parsed.data,
        userId: auth.userId,
        canDepositOthers: parsed.data.canDepositOthers,
        canEditPastWeeks: parsed.data.canEditPastWeeks,
      });
    } else {
      result = await deleteSale({
        ...parsed.data,
        userId: auth.userId,
        isAdmin: parsed.data.isAdmin,
      });
    }

    return fromDomainResult(request, result);
  }

  const parsed = parseJsonBody(createSaleSchema, {
    ...(body ?? {}),
    userId: (body as { userId?: string } | null)?.userId ?? auth.userId,
  });
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const created = await createSale(parsed.data);

  return fromDomainResult(request, created);
}
