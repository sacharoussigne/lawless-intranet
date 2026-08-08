import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  getChestStockVisibility,
  setChestCategoryHidden,
  setChestItemHidden,
} from '@/lib/domain/stockVisibility';
import { stockVisibilitySchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const chestId = url.searchParams.get('chestId');
  if (!chestId) return errorResponse(request, 'chestId requis', 400);

  return fromDomainResult(
    request,
    await getChestStockVisibility({ ...scope.data, chestId }),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(stockVisibilitySchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  if (parsed.data.categoryId) {
    return fromDomainResult(
      request,
      await setChestCategoryHidden({
        ...parsed.data,
        categoryId: parsed.data.categoryId,
      }),
    );
  }

  if (parsed.data.itemId) {
    return fromDomainResult(
      request,
      await setChestItemHidden({
        ...parsed.data,
        itemId: parsed.data.itemId,
      }),
    );
  }

  return errorResponse(request, 'categoryId ou itemId requis', 400);
}
