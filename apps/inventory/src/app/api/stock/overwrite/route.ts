import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import { overwriteStockForDate } from '@/lib/domain/stock';
import { overwriteStockSchema } from '@/lib/validation';
import { parseISO } from 'date-fns';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(overwriteStockSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const date =
    typeof parsed.data.date === 'string' ? parseISO(parsed.data.date) : parsed.data.date;

  return fromDomainResult(
    request,
    await overwriteStockForDate({
      ...parsed.data,
      date,
    }),
  );
}
