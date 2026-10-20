import { serviceActionError as mapServiceActionError } from '@lawless-intranet/host-kit/service-error';
import type { ActionResponse } from '@lawless-intranet/host-kit/action';
import { errorMessage, parseActionError } from '@/lib/action';
import { reportServerError } from '@/lib/logs/errorReporter';
import {
  requireTenantServerActionContext,
  type ServerActionGuardOptions,
} from '@/lib/serverActionAuth';

/**
 * Action response for an error thrown while calling a service: the service
 * status and message when it answered, otherwise the generic parser (Zod 422,
 * ErrorWithStatus, 500). Server errors go to the app log.
 */
export function serviceActionError(
  error: unknown,
  fallback: string,
  logContext?: { feature?: string; businessId?: string },
) {
  const response = mapServiceActionError(error, fallback, parseActionError);
  reportServerError({ error, status: response.status, message: errorMessage(response), ...logContext });
  return response;
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
  let businessId: string | undefined;
  try {
    const ctx = await requireTenantServerActionContext(slug, guard);
    if (!ctx.ok) return ctx.response;
    businessId = ctx.tenant.businessId;
    return { status: successStatus, data: await call(businessId) };
  } catch (error) {
    return serviceActionError(error, fallback, { feature: guard.feature, businessId });
  }
}
