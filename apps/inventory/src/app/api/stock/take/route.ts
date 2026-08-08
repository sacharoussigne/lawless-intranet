import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { moveItemsWithChests } from '@/lib/domain/stock';
import { takeStockSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(takeStockSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  return fromDomainResult(
    request,
    await moveItemsWithChests({
      ...parsed.data,
      userId: parsed.data.userId ?? auth.userId,
    }),
  );
}
