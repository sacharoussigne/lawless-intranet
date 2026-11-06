import { requireTenantServerActionContext, type AuthSession } from '@/lib/serverActionAuth';
import {
  requireCabinetRead,
  requireCabinetWrite,
  requireCabinetOwner,
} from '@/lib/cabinet/access';
import prisma from '@/lib/prisma';
import { tenantWhere } from '@/lib/business/tenantWhere';

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

export async function resolveCabinetIdFromPatientId(
  businessId: string,
  patientId: string,
): Promise<string | null> {
  const patient = await prisma.cabinetPatient.findFirst({
    where: {
      id: patientId,
      cabinet: tenantWhere(businessId),
    },
    select: { cabinetId: true },
  });
  return patient?.cabinetId ?? null;
}

export async function resolveCabinetIdFromCareEpisodeId(
  businessId: string,
  episodeId: string,
): Promise<string | null> {
  const episode = await prisma.careEpisode.findFirst({
    where: {
      id: episodeId,
      patient: { cabinet: tenantWhere(businessId) },
    },
    select: { patient: { select: { cabinetId: true } } },
  });
  return episode?.patient.cabinetId ?? null;
}

export async function resolveCabinetIdFromConsultationId(
  businessId: string,
  consultationId: string,
): Promise<string | null> {
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      careEpisode: { patient: { cabinet: tenantWhere(businessId) } },
    },
    select: { careEpisode: { select: { patient: { select: { cabinetId: true } } } } },
  });
  return consultation?.careEpisode.patient.cabinetId ?? null;
}
