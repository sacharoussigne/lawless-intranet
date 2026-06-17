import { requireTenantServerActionContext, type AuthSession } from '@/lib/serverActionAuth';
import {
  requireCabinetRead,
  requireCabinetWrite,
  requireCabinetOwner,
} from '@/lib/cabinet/access';
import prisma from '@/lib/prisma';
import { isPlatformAdmin } from '@/lib/dispensary/platformAdmin';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { batchGetUsers, searchUsers } from '@lawless-intranet/auth-client/server';
import { getCookieHeader } from '@/lib/authUsers';

export type CabinetEligibleUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function searchEligibleDispensaryUsersForCabinet(
  dispensaryId: string,
  query: string,
): Promise<CabinetEligibleUser[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const cookieHeader = await getCookieHeader();
  const [members, matchingUsers] = await Promise.all([
    prisma.dispensaryMember.findMany({
      where: { dispensaryId },
      select: { userId: true },
    }),
    searchUsers(q, cookieHeader),
  ]);

  const memberIds = new Set(members.map((member) => member.userId));
  const candidateIds = new Set<string>();

  for (const user of matchingUsers) {
    if (memberIds.has(user.id)) {
      candidateIds.add(user.id);
    } else if (isPlatformAdmin(user.role)) {
      candidateIds.add(user.id);
    }
  }

  const profiles = await batchGetUsers([...candidateIds], cookieHeader);

  return profiles
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email ?? '',
      image: user.image,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .slice(0, 20);
}

export async function requireCabinetFeatureContext(dispensarySlug: string) {
  return requireTenantServerActionContext(dispensarySlug, {
    feature: 'cabinet',
  });
}

export async function getCabinetSessionContext(dispensarySlug: string) {
  const ctx = await requireCabinetFeatureContext(dispensarySlug);
  if (!ctx.ok) return ctx;
  return {
    ok: true as const,
    tenant: ctx.tenant,
    session: ctx.session,
  };
}

export async function guardCabinetRead(
  dispensaryId: string,
  cabinetId: string,
  session: AuthSession,
  effectiveRole: string | null | undefined,
) {
  return requireCabinetRead(
    dispensaryId,
    cabinetId,
    session.user.id,
    session.user.role,
    effectiveRole,
  );
}

export async function guardCabinetWrite(
  dispensaryId: string,
  cabinetId: string,
  session: AuthSession,
  effectiveRole: string | null | undefined,
) {
  return requireCabinetWrite(
    dispensaryId,
    cabinetId,
    session.user.id,
    session.user.role,
    effectiveRole,
  );
}

export async function guardCabinetOwner(
  dispensaryId: string,
  cabinetId: string,
  session: AuthSession,
  effectiveRole: string | null | undefined,
) {
  return requireCabinetOwner(
    dispensaryId,
    cabinetId,
    session.user.id,
    session.user.role,
    effectiveRole,
  );
}

export async function resolveCabinetIdFromPatientId(
  dispensaryId: string,
  patientId: string,
): Promise<string | null> {
  const patient = await prisma.cabinetPatient.findFirst({
    where: {
      id: patientId,
      cabinet: tenantWhere(dispensaryId),
    },
    select: { cabinetId: true },
  });
  return patient?.cabinetId ?? null;
}

export async function resolveCabinetIdFromCareEpisodeId(
  dispensaryId: string,
  episodeId: string,
): Promise<string | null> {
  const episode = await prisma.careEpisode.findFirst({
    where: {
      id: episodeId,
      patient: { cabinet: tenantWhere(dispensaryId) },
    },
    select: { patient: { select: { cabinetId: true } } },
  });
  return episode?.patient.cabinetId ?? null;
}

export async function resolveCabinetIdFromConsultationId(
  dispensaryId: string,
  consultationId: string,
): Promise<string | null> {
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: consultationId,
      careEpisode: { patient: { cabinet: tenantWhere(dispensaryId) } },
    },
    select: { careEpisode: { select: { patient: { select: { cabinetId: true } } } } },
  });
  return consultation?.careEpisode.patient.cabinetId ?? null;
}

export async function validateDispensaryUserIds(
  dispensaryId: string,
  userIds: string[],
): Promise<boolean> {
  if (userIds.length === 0) return true;

  const cookieHeader = await getCookieHeader();
  const users = await batchGetUsers(userIds, cookieHeader);
  if (users.length !== userIds.length) return false;

  const memberRequiredIds = users
    .filter((user) => !isPlatformAdmin(user.role))
    .map((user) => user.id);

  if (memberRequiredIds.length === 0) return true;

  const memberCount = await prisma.dispensaryMember.count({
    where: {
      ...tenantWhere(dispensaryId),
      userId: { in: memberRequiredIds },
    },
  });

  return memberCount === memberRequiredIds.length;
}
