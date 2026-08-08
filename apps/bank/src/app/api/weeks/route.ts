import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseScopeQuery, parseJsonBody } from '@/lib/request';
import { getOrCreateWeek, listWeeks } from '@/lib/domain';
import { scopeFieldsSchema } from '@/lib/validation';
import { z } from 'zod';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const dateParam = url.searchParams.get('date');
  if (dateParam) {
    const date = new Date(dateParam);
    if (Number.isNaN(date.getTime())) {
      return errorResponse(request, 'Date invalide', 400);
    }
    const week = await getOrCreateWeek(scope.data.scopeType, scope.data.scopeId, date);
    return jsonResponse(request, week);
  }

  const weeks = await listWeeks(scope.data.scopeType, scope.data.scopeId);
  return jsonResponse(request, weeks);
}

const getOrCreateBodySchema = scopeFieldsSchema.extend({
  date: z.string().or(z.date()),
});

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(getOrCreateBodySchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const date =
    typeof parsed.data.date === 'string' ? new Date(parsed.data.date) : parsed.data.date;
  if (Number.isNaN(date.getTime())) {
    return errorResponse(request, 'Date invalide', 400);
  }

  const week = await getOrCreateWeek(parsed.data.scopeType, parsed.data.scopeId, date);
  return jsonResponse(request, week, 200);
}
