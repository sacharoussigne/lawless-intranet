import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { getStockMovementReconciliation } from '@/lib/domain/movements';
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

  const itemId = url.searchParams.get('itemId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!itemId || !from || !to) {
    return errorResponse(request, 'itemId, from and to are required', 400);
  }

  return fromDomainResult(
    request,
    await getStockMovementReconciliation({
      ...scope.data,
      itemId,
      chestFilter: url.searchParams.get('chestFilter') ?? 'all',
      from: parseISO(from),
      to: parseISO(to),
    }),
  );
}
