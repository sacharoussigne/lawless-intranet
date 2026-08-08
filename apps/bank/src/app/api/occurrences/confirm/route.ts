import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { confirmOccurrence } from '@/lib/domain';
import { scopeFieldsSchema } from '@/lib/validation';
import { z } from 'zod';

const schema = scopeFieldsSchema.extend({
  id: z.string().uuid(),
  date: z.string().or(z.date()).optional().nullable(),
});

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(schema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await confirmOccurrence(
    parsed.data.scopeType,
    parsed.data.scopeId,
    parsed.data.id,
    parsed.data.date,
  );
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.transaction);
}
