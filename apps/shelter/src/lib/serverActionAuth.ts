import { getAuthSession } from '@/lib/authSession';
import { getAppFeatureActionBlock, type AppFeatureKey } from '@/lib/appSettings';
import { can } from '@/lib/shelter/permissionsCatalog';
import { requireTenantActionContext, type TenantActionContext } from '@/lib/shelter/serverActionContext';

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;

export type ActionFailure = {
  status: number;
  error: string;
};

export async function requireSession(): Promise<
  { ok: true; session: AuthSession } | { ok: false; response: ActionFailure }
> {
  const session = await getAuthSession();
  if (!session) {
    return { ok: false, response: { status: 401, error: 'Non autorisé' } };
  }
  return { ok: true, session };
}

export async function requireFeature(
  shelterId: string,
  feature: AppFeatureKey,
): Promise<{ ok: true } | { ok: false; response: ActionFailure }> {
  const block = await getAppFeatureActionBlock(shelterId, feature);
  if (block) {
    return { ok: false, response: block };
  }
  return { ok: true };
}

export function requireEffectivePermission(
  effectivePermissions: Iterable<string> | null | undefined,
  resource: string,
  action: string,
  message = 'Permission refusée',
): { ok: true } | { ok: false; response: ActionFailure } {
  if (!can(effectivePermissions, resource, action)) {
    return { ok: false, response: { status: 403, error: message } };
  }
  return { ok: true };
}

export type ServerActionGuardOptions = {
  feature?: AppFeatureKey;
  permission?: {
    resource: string;
    action: string;
    message?: string;
  };
};

export async function requireTenantServerActionContext(
  shelterSlug: string,
  options: ServerActionGuardOptions = {},
): Promise<
  | { ok: true; session: AuthSession; tenant: TenantActionContext }
  | { ok: false; response: ActionFailure }
> {
  const tenantResult = await requireTenantActionContext(shelterSlug);
  if (!tenantResult.ok) {
    return { ok: false, response: { status: tenantResult.status, error: tenantResult.error } };
  }

  const sessionResult = await requireSession();
  if (!sessionResult.ok) return sessionResult;

  if (options.feature) {
    const featureResult = await requireFeature(tenantResult.ctx.shelterId, options.feature);
    if (!featureResult.ok) return featureResult;
  }

  if (options.permission) {
    const permResult = requireEffectivePermission(
      tenantResult.ctx.effectivePermissions,
      options.permission.resource,
      options.permission.action,
      options.permission.message,
    );
    if (!permResult.ok) return permResult;
  }

  return { ok: true, session: sessionResult.session, tenant: tenantResult.ctx };
}
