import { requireTenantServerActionContext, type AuthSession } from '@/lib/serverActionAuth';
import {
  requireCabinetRead,
  requireCabinetWrite,
  requireCabinetOwner,
} from '@/lib/cabinet/access';

export {
  searchEligibleBusinessUsers as searchEligibleBusinessUsersForCabinet,
  validateBusinessUserIds,
  type EligibleBusinessUser as CabinetEligibleUser,
} from '@/lib/business/eligibleUsers';

export async function requireCabinetFeatureContext(businessSlug: string) {
  return requireTenantServerActionContext(businessSlug, {
    feature: 'cabinet',
  });
}

export async function getCabinetSessionContext(businessSlug: string) {
  const ctx = await requireCabinetFeatureContext(businessSlug);
  if (!ctx.ok) return ctx;
  return {
    ok: true as const,
    tenant: ctx.tenant,
    session: ctx.session,
  };
}

export async function guardCabinetRead(
  businessId: string,
  cabinetId: string,
  session: AuthSession,
  effectiveRole: string | null | undefined,
) {
  return requireCabinetRead(
    businessId,
    cabinetId,
    session.user.id,
    session.user.role,
    effectiveRole,
  );
}

export async function guardCabinetWrite(
  businessId: string,
  cabinetId: string,
  session: AuthSession,
  effectiveRole: string | null | undefined,
) {
  return requireCabinetWrite(
    businessId,
    cabinetId,
    session.user.id,
    session.user.role,
    effectiveRole,
  );
}

export async function guardCabinetOwner(
  businessId: string,
  cabinetId: string,
  session: AuthSession,
  effectiveRole: string | null | undefined,
) {
  return requireCabinetOwner(
    businessId,
    cabinetId,
    session.user.id,
    session.user.role,
    effectiveRole,
  );
}
