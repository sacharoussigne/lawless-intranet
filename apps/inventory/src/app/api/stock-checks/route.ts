import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  getChestStockCheckConfigs,
  getStockChecksSummary,
  upsertChestStockCheckConfig,
} from '@/lib/domain/stockChecks';
import { upsertStockCheckSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  if (url.searchParams.get('summary') === 'true') {
    return fromDomainResult(
      request,
      await getStockChecksSummary(scope.data.scopeType, scope.data.scopeId),
    );
  }

  return fromDomainResult(
    request,
    await getChestStockCheckConfigs(scope.data.scopeType, scope.data.scopeId),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(upsertStockCheckSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await upsertChestStockCheckConfig(parsed.data));
}
