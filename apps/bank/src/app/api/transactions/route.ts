import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { createTransaction } from '@/lib/domain';
import { createTransactionSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(createTransactionSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await createTransaction(parsed.data);
  if (!result.ok) return errorResponse(request, result.error, result.status);
  return jsonResponse(request, result.data, result.status);
}
