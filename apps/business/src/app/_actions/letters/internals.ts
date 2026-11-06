import { requireFeature, requireTenantServerActionContext, type AuthSession } from '@/lib/serverActionAuth';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import { requireLetterBoxAccess } from '@/lib/letters/access';
import type { TenantActionContext } from '@/lib/business/serverActionContext';

/** Letters: the feature toggle, then the box member list (no role permission, like the cabinet). */
export async function getLettersContext(businessSlug: string) {
  return requireTenantServerActionContext(businessSlug, { feature: 'letters' });
}

export type LettersContext = { session: AuthSession; tenant: TenantActionContext };

/** Admin pages of the boxes: business admin and the feature turned on. */
export async function getLettersAdminContext(businessSlug: string) {
  const auth = await requireBusinessAdminContext(businessSlug);
  if (!auth.ok) return { ok: false as const, response: { status: auth.status, error: auth.error } };
  const feature = await requireFeature(auth.ctx.businessId, 'letters');
  if (!feature.ok) return feature;
  return { ok: true as const, tenant: auth.ctx };
}

export function guardLetterBox(ctx: LettersContext, boxId: string, need: 'read' | 'write' | 'owner') {
  return requireLetterBoxAccess(ctx.tenant.businessId, boxId, ctx.session.user.id, need);
}
