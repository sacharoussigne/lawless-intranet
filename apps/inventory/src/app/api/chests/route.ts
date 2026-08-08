import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  createChest,
  deleteChest,
  listChests,
  listChestsLite,
  reorderChests,
  updateChest,
} from '@/lib/domain/chests';
import {
  createChestSchema,
  deleteChestSchema,
  reorderItemsSchema,
  updateChestSchema,
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

  const onlyEnabled = url.searchParams.get('onlyEnabled') === 'true';
  const lite = url.searchParams.get('lite') === 'true';
  const effectiveRole = url.searchParams.get('effectiveRole');

  if (lite) {
    return fromDomainResult(
      request,
      await listChestsLite(scope.data.scopeType, scope.data.scopeId, {
        onlyEnabled,
        effectiveRole,
        bypassAccessFilter: url.searchParams.get('bypassAccessFilter') === 'true',
      }),
    );
  }

  return fromDomainResult(
    request,
    await listChests(scope.data.scopeType, scope.data.scopeId, onlyEnabled),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const action = (body as { action?: string } | null)?.action;

  if (action === 'reorder') {
    const parsed = parseJsonBody(reorderItemsSchema, body);
    if (!parsed.ok) return errorResponse(request, parsed.error, 400);
    return fromDomainResult(request, await reorderChests(parsed.data));
  }

  const parsed = parseJsonBody(createChestSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createChest(parsed.data));
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateChestSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await updateChest(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteChestSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteChest(parsed.data));
}
