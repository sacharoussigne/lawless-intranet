import type { CabinetAccessLevel } from '@prisma/client';
import prisma from '@/lib/prisma';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { isPlatformAdmin } from '@/lib/dispensary/platformAdmin';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { Role } from '@/types/enum/roles';
import {
  canOwnCabinet,
  canReadCabinet,
  canWriteCabinet,
} from '@/types/cabinet';

export type CabinetAccessResult =
  | { ok: true; accessLevel: CabinetAccessLevel | null; isDispensaryAdmin: boolean }
  | { ok: false; status: number; error: string };

export function isDispensaryAdminRole(
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): boolean {
  return isPlatformAdmin(platformRole) || hasRole(effectiveRole, Role.ADMIN);
}

export async function resolveCabinetAccess(
  dispensaryId: string,
  cabinetId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<CabinetAccessResult> {
  const cabinet = await prisma.cabinet.findFirst({
    where: { id: cabinetId, ...tenantWhere(dispensaryId) },
    select: { id: true },
  });

  if (!cabinet) {
    return { ok: false, status: 404, error: 'Cabinet introuvable' };
  }

  const membership = await prisma.cabinetMember.findUnique({
    where: { cabinetId_userId: { cabinetId, userId } },
    select: { accessLevel: true },
  });

  if (!membership) {
    return { ok: false, status: 403, error: 'Accès non autorisé à ce cabinet' };
  }

  return {
    ok: true,
    accessLevel: membership.accessLevel,
    isDispensaryAdmin: isDispensaryAdminRole(platformRole, effectiveRole),
  };
}

export async function requireCabinetRead(
  dispensaryId: string,
  cabinetId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<CabinetAccessResult> {
  const access = await resolveCabinetAccess(
    dispensaryId,
    cabinetId,
    userId,
    platformRole,
    effectiveRole,
  );
  if (!access.ok) return access;

  if (!canReadCabinet(access.accessLevel)) {
    return { ok: false, status: 403, error: 'Accès lecture requis' };
  }

  return access;
}

export async function requireCabinetWrite(
  dispensaryId: string,
  cabinetId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<CabinetAccessResult> {
  const access = await resolveCabinetAccess(
    dispensaryId,
    cabinetId,
    userId,
    platformRole,
    effectiveRole,
  );
  if (!access.ok) return access;

  if (!canWriteCabinet(access.accessLevel)) {
    return { ok: false, status: 403, error: 'Accès écriture requis' };
  }

  return access;
}

export async function requireCabinetOwner(
  dispensaryId: string,
  cabinetId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<CabinetAccessResult> {
  const access = await resolveCabinetAccess(
    dispensaryId,
    cabinetId,
    userId,
    platformRole,
    effectiveRole,
  );
  if (!access.ok) return access;

  if (!canOwnCabinet(access.accessLevel)) {
    return { ok: false, status: 403, error: 'Droits propriétaire requis' };
  }

  return access;
}

export async function canManageCabinetMembers(
  dispensaryId: string,
  cabinetId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<boolean> {
  if (isDispensaryAdminRole(platformRole, effectiveRole)) {
    return true;
  }

  const membership = await prisma.cabinetMember.findUnique({
    where: { cabinetId_userId: { cabinetId, userId } },
    select: { accessLevel: true },
  });

  return canOwnCabinet(membership?.accessLevel);
}

export async function canEditCabinetFormSchema(
  dispensaryId: string,
  cabinetId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<boolean> {
  if (isDispensaryAdminRole(platformRole, effectiveRole)) {
    return true;
  }

  const membership = await prisma.cabinetMember.findUnique({
    where: { cabinetId_userId: { cabinetId, userId } },
    select: { accessLevel: true },
  });

  return canOwnCabinet(membership?.accessLevel);
}

export async function listAccessibleCabinetIds(
  dispensaryId: string,
  userId: string,
): Promise<string[]> {
  const memberships = await prisma.cabinetMember.findMany({
    where: {
      userId,
      cabinet: tenantWhere(dispensaryId),
    },
    select: { cabinetId: true },
  });

  return memberships.map((m) => m.cabinetId);
}

export async function userHasAnyCabinetAccess(
  dispensaryId: string,
  userId: string,
): Promise<boolean> {
  const membershipCount = await prisma.cabinetMember.count({
    where: {
      userId,
      cabinet: tenantWhere(dispensaryId),
    },
  });

  return membershipCount > 0;
}
