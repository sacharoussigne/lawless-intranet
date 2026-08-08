import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { getStockConsumptionStats } from '@/lib/domain/stock';
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

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to) return errorResponse(request, 'from et to requis', 400);

  return fromDomainResult(
    request,
    await getStockConsumptionStats({
      ...scope.data,
      from: parseISO(from),
      to: parseISO(to),
    }),
  );
}
