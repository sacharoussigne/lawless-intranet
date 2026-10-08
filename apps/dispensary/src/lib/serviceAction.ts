import { serviceActionError as mapServiceActionError } from '@lawless-intranet/host-kit/service-error';
import type { ActionResponse } from '@lawless-intranet/host-kit/action';
import { actionErrorParser } from '@/lib/action';
import {
  requireTenantServerActionContext,
  type ServerActionGuardOptions,
} from '@/lib/serverActionAuth';

/**
 * Action response for an error thrown while calling a service: the service
 * status and message when it answered, otherwise the generic parser (Zod 422,
 * ErrorWithStatus, 500).
 */
export function serviceActionError(error: unknown, fallback: string) {
  return mapServiceActionError(error, fallback, actionErrorParser);
}

/**
 * Server action calling a service for the tenant of `slug`: tenant guard
 * (session, feature, permission), then `call` with the tenant id; any error
 * becomes an action response.
 */
export async function withTenantService<T>(
  slug: string,
  guard: ServerActionGuardOptions,
  fallback: string,
  call: (tenantId: string) => Promise<T>,
  successStatus = 200,
): Promise<ActionResponse<T>> {
  try {
    const ctx = await requireTenantServerActionContext(slug, guard);
    if (!ctx.ok) return ctx.response;
    return { status: successStatus, data: await call(ctx.tenant.dispensaryId) };
  } catch (error) {
    return serviceActionError(error, fallback);
  }
}
