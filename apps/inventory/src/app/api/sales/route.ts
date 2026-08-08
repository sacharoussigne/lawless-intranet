import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
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

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
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
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const action = (body as { action?: string } | null)?.action;

  if (action === 'cancel' || action === 'deposit' || action === 'delete') {
    const parsed = parseJsonBody(saleActionSchema, body);
    if (!parsed.ok) return errorResponse(request, parsed.error, 400);

    if (action === 'cancel') {
      return fromDomainResult(
        request,
        await cancelSale({
          ...parsed.data,
          userId: auth.userId,
          canViewAll: parsed.data.canViewAll,
        }),
      );
    }
    if (action === 'deposit') {
      return fromDomainResult(
        request,
        await depositSale({
          ...parsed.data,
          userId: auth.userId,
          canDepositOthers: parsed.data.canDepositOthers,
        }),
      );
    }
    return fromDomainResult(
      request,
      await deleteSale({
        ...parsed.data,
        userId: auth.userId,
        isAdmin: parsed.data.isAdmin,
      }),
    );
  }

  const parsed = parseJsonBody(createSaleSchema, {
    ...(body ?? {}),
    userId: (body as { userId?: string } | null)?.userId ?? auth.userId,
  });
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createSale(parsed.data));
}
