import { z } from 'zod';
import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  deleteStockMovements,
  listStockMovements,
  updateStockMovement,
} from '@/lib/domain/movements';
import { scopeFieldsSchema } from '@/lib/validation';
import { parseISO } from 'date-fns';

const updateSchema = scopeFieldsSchema.extend({
  id: z.string().uuid(),
  quantity: z.number().int().optional(),
  kind: z
    .enum([
      'MANUAL_FIRST_COUNT',
      'MANUAL_ADJUST',
      'CRAFT_CONSUME',
      'CRAFT_PRODUCE',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'OVERWRITE',
      'TAKE_OUT',
      'DEPOSIT_IN',
      'SALE_OUT',
      'SALE_CANCEL_RESTORE',
      'ORDER_IN',
      'ORDER_OUT',
    ])
    .optional(),
  note: z.string().max(500).nullable().optional(),
});

const deleteSchema = scopeFieldsSchema.extend({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  return fromDomainResult(
    request,
    await listStockMovements({
      ...scope.data,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 25),
      itemSearch: url.searchParams.get('itemSearch') ?? undefined,
      itemId: url.searchParams.get('itemId') ?? undefined,
      chestFilter: url.searchParams.get('chestFilter') ?? undefined,
      kind: (url.searchParams.get('kind') as never) ?? undefined,
      from: from ? parseISO(from) : undefined,
      to: to ? parseISO(to) : undefined,
    }),
  );
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await updateStockMovement(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteStockMovements(parsed.data));
}
