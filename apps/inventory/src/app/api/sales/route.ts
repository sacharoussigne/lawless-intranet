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
import prisma from '@/lib/prisma';
import { fanInSaleRealtimeToDispensary } from '@/lib/realtime/salesFanIn';
import { scopeWhere } from '@/lib/scope';
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

async function loadSaleRealtimeTarget(
  scopeType: string,
  scopeId: string,
  saleId: string,
): Promise<{ id: string; userId: string; createdAt: Date } | null> {
  return prisma.sale.findFirst({
    where: { id: saleId, ...scopeWhere(scopeType, scopeId) },
    select: { id: true, userId: true, createdAt: true },
  });
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const action = (body as { action?: string } | null)?.action;

  if (action === 'cancel' || action === 'deposit' || action === 'delete') {
    const parsed = parseJsonBody(saleActionSchema, body);
    if (!parsed.ok) return errorResponse(request, parsed.error, 400);

    const existing = await loadSaleRealtimeTarget(
      parsed.data.scopeType,
      parsed.data.scopeId,
      parsed.data.id,
    );

    let result;
    if (action === 'cancel') {
      result = await cancelSale({
        ...parsed.data,
        userId: auth.userId,
        canViewAll: parsed.data.canViewAll,
      });
    } else if (action === 'deposit') {
      result = await depositSale({
        ...parsed.data,
        userId: auth.userId,
        canDepositOthers: parsed.data.canDepositOthers,
      });
    } else {
      result = await deleteSale({
        ...parsed.data,
        userId: auth.userId,
        isAdmin: parsed.data.isAdmin,
      });
    }

    if (result.ok && existing) {
      await fanInSaleRealtimeToDispensary({
        scopeType: parsed.data.scopeType,
        scopeId: parsed.data.scopeId,
        saleId: existing.id,
        ownerUserId: existing.userId,
        createdAt: existing.createdAt,
        originClientId: parsed.data.originClientId,
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
  if (created.ok) {
    await fanInSaleRealtimeToDispensary({
      scopeType: parsed.data.scopeType,
      scopeId: parsed.data.scopeId,
      saleId: created.data.id,
      ownerUserId: created.data.userId,
      createdAt: created.data.createdAt,
      originClientId: parsed.data.originClientId,
    });
  }

  return fromDomainResult(request, created);
}
