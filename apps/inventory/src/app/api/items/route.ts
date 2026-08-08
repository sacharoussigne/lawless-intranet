import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  createItem,
  deleteItem,
  listItems,
  reorderItems,
  updateItem,
} from '@/lib/domain/items';
import {
  createItemSchema,
  deleteByIdSchema,
  reorderItemsSchema,
  updateItemSchema,
} from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const companyGroupId = url.searchParams.get('companyGroupId');
  const result = await listItems(scope.data.scopeType, scope.data.scopeId, {
    companyGroupId: companyGroupId || undefined,
  });
  return fromDomainResult(request, result);
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const action = (body as { action?: string } | null)?.action;

  if (action === 'reorder') {
    const parsed = parseJsonBody(reorderItemsSchema, body);
    if (!parsed.ok) return errorResponse(request, parsed.error, 400);
    return fromDomainResult(request, await reorderItems(parsed.data));
  }

  const parsed = parseJsonBody(createItemSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createItem(parsed.data));
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateItemSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await updateItem(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteByIdSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteItem(parsed.data));
}
