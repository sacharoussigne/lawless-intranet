import type { BusinessType } from '@prisma/client';
import { rolesOfGrade } from '@/lib/businessTypes';
import { parseRoleList, serializeRoleList, type BusinessMemberRole } from '@/types/enum/roles';

/**
 * Intranet roles of a member: those of the RP grade while employed, plus the
 * roles given by hand (Réglages › Membres). Client-safe.
 */
export function effectiveMemberRoles(input: {
  type: BusinessType;
  employed: boolean;
  grade: string | null | undefined;
  manualRoles: string | null | undefined;
}): string {
  const fromGrade = input.employed ? rolesOfGrade(input.type, input.grade) : [];
  return serializeRoleList([...fromGrade, ...parseRoleList(input.manualRoles)].sort());
}

/** Roles of the grade alone (empty when not employed). */
export function gradeMemberRoles(
  type: BusinessType,
  employed: boolean,
  grade: string | null | undefined,
): readonly BusinessMemberRole[] {
  return employed ? rolesOfGrade(type, grade) : [];
}
