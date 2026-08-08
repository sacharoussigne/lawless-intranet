import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  createCompanyGroup,
  deleteCompanyGroup,
  listCompanyGroups,
  listCompanyGroupsForOrders,
  listCompanyGroupsForSelect,
  updateCompanyGroup,
} from '@/lib/domain/companyGroups';
import {
  createCompanyGroupSchema,
  deleteByIdSchema,
  updateCompanyGroupSchema,
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

  const mode = url.searchParams.get('mode');
  if (mode === 'select') {
    return fromDomainResult(
      request,
      await listCompanyGroupsForSelect(scope.data.scopeType, scope.data.scopeId),
    );
  }
  if (mode === 'orders') {
    return fromDomainResult(
      request,
      await listCompanyGroupsForOrders(scope.data.scopeType, scope.data.scopeId),
    );
  }

  return fromDomainResult(
    request,
    await listCompanyGroups(scope.data.scopeType, scope.data.scopeId),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(createCompanyGroupSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createCompanyGroup(parsed.data));
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateCompanyGroupSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await updateCompanyGroup(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteByIdSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteCompanyGroup(parsed.data));
}
