import { requireSession, errorResponse } from '@/lib/auth';
import { corsPreflightResponse } from '@/lib/cors';
import { parseJsonBody, parseScopeQuery } from '@/lib/request';
import { fromDomainResult } from '@/lib/http';
import {
  createCompany,
  deleteCompany,
  listCompanies,
  listCompaniesForSelect,
  updateCompany,
} from '@/lib/domain/companies';
import { createCompanySchema, deleteByIdSchema, updateCompanySchema } from '@/lib/validation';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const scope = parseScopeQuery(url);
  if (!scope.ok) return errorResponse(request, scope.error, 400);

  if (url.searchParams.get('select') === 'true') {
    return fromDomainResult(
      request,
      await listCompaniesForSelect(scope.data.scopeType, scope.data.scopeId),
    );
  }

  return fromDomainResult(
    request,
    await listCompanies(scope.data.scopeType, scope.data.scopeId),
  );
}

export async function POST(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(createCompanySchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await createCompany(parsed.data));
}

export async function PATCH(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(updateCompanySchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await updateCompany(parsed.data));
}

export async function DELETE(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(deleteByIdSchema, body);
  if (!parsed.ok) return errorResponse(request, parsed.error, 400);
  return fromDomainResult(request, await deleteCompany(parsed.data));
}
