import { requireSession, jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody } from '@/lib/request';
import { importTransactions } from '@/lib/domain';
import { importTransactionsSchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(importTransactionsSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);

  const result = await importTransactions(parsed.data);
  return jsonResponse(request, result.data, result.status);
}
