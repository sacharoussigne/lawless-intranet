import type { LetterBoxAccessLevel } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isBusinessAdminRole } from '@/lib/cabinet/access';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { canOwnLetterBox, canReadLetterBox, canWriteLetterBox } from '@/types/letters';

/** Same model as the cabinet: access is the box member list; admins only manage boxes and members. */
export type LetterBoxAccessResult =
  | { ok: true; accessLevel: LetterBoxAccessLevel }
  | { ok: false; status: number; error: string };

type Need = 'read' | 'write' | 'owner';

const NEED_CHECK: Record<Need, { check: (level: LetterBoxAccessLevel) => boolean; error: string }> = {
  read: { check: canReadLetterBox, error: 'Accès lecture requis' },
  write: { check: canWriteLetterBox, error: 'Accès écriture requis' },
  owner: { check: canOwnLetterBox, error: 'Droits propriétaire requis' },
};

export async function requireLetterBoxAccess(
  businessId: string,
  boxId: string,
  userId: string,
  need: Need,
): Promise<LetterBoxAccessResult> {
  const box = await prisma.letterBox.findFirst({
    where: { id: boxId, ...tenantWhere(businessId) },
    select: { members: { where: { userId }, select: { accessLevel: true } } },
  });
  if (!box) return { ok: false, status: 404, error: 'Boîte aux lettres introuvable' };

  const accessLevel = box.members[0]?.accessLevel;
  if (!accessLevel) return { ok: false, status: 403, error: 'Accès non autorisé à cette boîte aux lettres' };
  if (!NEED_CHECK[need].check(accessLevel)) return { ok: false, status: 403, error: NEED_CHECK[need].error };
  return { ok: true, accessLevel };
}

/** Owners of the box, and admins of the business, manage who has access. */
export async function canManageLetterBoxMembers(
  boxId: string,
  userId: string,
  platformRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): Promise<boolean> {
  if (isBusinessAdminRole(platformRole, effectiveRole)) return true;
  const membership = await prisma.letterBoxMember.findUnique({
    where: { boxId_userId: { boxId, userId } },
    select: { accessLevel: true },
  });
  return canOwnLetterBox(membership?.accessLevel);
}

export async function listAccessibleLetterBoxIds(businessId: string, userId: string): Promise<string[]> {
  const memberships = await prisma.letterBoxMember.findMany({
    where: { userId, box: tenantWhere(businessId) },
    select: { boxId: true },
  });
  return memberships.map((membership) => membership.boxId);
}

export async function userHasAnyLetterBoxAccess(businessId: string, userId: string): Promise<boolean> {
  return (await prisma.letterBoxMember.count({ where: { userId, box: tenantWhere(businessId) } })) > 0;
}
