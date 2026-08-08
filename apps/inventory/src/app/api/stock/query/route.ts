import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  getLastStockDaysByChest,
  queryItemsWithDetailedStock,
  queryItemsWithStock,
  queryItemsWithStockForDate,
} from '@/lib/domain/stock';
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

  const mode = url.searchParams.get('mode') ?? 'today';
  const chestId = url.searchParams.get('chestId');
  const effectiveRole = url.searchParams.get('effectiveRole');

  if (mode === 'last-days') {
    return fromDomainResult(
      request,
      await getLastStockDaysByChest({
        ...scope.data,
        effectiveRole,
      }),
    );
  }

  if (mode === 'detailed') {
    const itemIds = url.searchParams.getAll('itemId');
    return fromDomainResult(
      request,
      await queryItemsWithDetailedStock({
        ...scope.data,
        itemIds: itemIds.length ? itemIds : undefined,
        effectiveRole,
      }),
    );
  }

  if (mode === 'date') {
    const dateParam = url.searchParams.get('date');
    if (!dateParam) return errorResponse(request, 'date requis', 400);
    return fromDomainResult(
      request,
      await queryItemsWithStockForDate({
        ...scope.data,
        date: parseISO(dateParam),
        chestId,
        effectiveRole,
      }),
    );
  }

  return fromDomainResult(
    request,
    await queryItemsWithStock({
      ...scope.data,
      chestId,
      effectiveRole,
    }),
  );
}
