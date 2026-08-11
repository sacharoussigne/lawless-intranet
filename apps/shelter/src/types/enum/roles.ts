export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
}

export const SHELTER_MEMBER_ROLES = [Role.ADMIN, Role.EMPLOYEE] as const;

export type ShelterMemberRole = (typeof SHELTER_MEMBER_ROLES)[number];

export function parseRoleList(roleNames: string | null | undefined): Role[] {
  if (!roleNames) {
    return [];
  }
  return roleNames
    .split(',')
    .map((r) => r.trim())
    .filter((r): r is Role => Object.values(Role).includes(r as Role));
}

export function formatRolesList(roleNames: string | null | undefined): string {
  return parseRoleList(roleNames)
    .map((r) => rolesAsString(r))
    .join(', ');
}

export function serializeRoleList(roles: string[]): string {
  const unique = [...new Set(roles.map((r) => r.trim()).filter((r) => r.length > 0))];
  return unique.join(',');
}

export const rolesAsString = (role: Role): string => {
  switch (role) {
    case Role.USER:
      return 'Utilisateur';
    case Role.ADMIN:
      return 'Administrateur';
    case Role.EMPLOYEE:
      return 'Employé';
  }
};
