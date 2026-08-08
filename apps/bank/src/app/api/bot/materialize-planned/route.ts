import { jsonResponse, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { materializePlannedOccurrencesForDay } from '@/lib/planned';

function isBotAuthorized(request: Request): boolean {
  const secret = process.env.BANK_BOT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return request.headers.get('x-bank-bot-secret') === secret;
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  if (!isBotAuthorized(request)) {
    return errorResponse(request, 'Unauthorized', 401);
  }

  const scopeType = request.headers.get('x-scope-type') ?? 'dispensary';
  const scopeId = request.headers.get('x-scope-id') ?? request.headers.get('x-dispensary-id');
  if (!scopeId) {
    return errorResponse(request, 'Missing X-Scope-Id (or X-Dispensary-Id)', 400);
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get('date');
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return errorResponse(request, 'Date invalide', 400);
  }

  const result = await materializePlannedOccurrencesForDay(scopeType, scopeId, targetDate);
  return jsonResponse(request, result);
}
