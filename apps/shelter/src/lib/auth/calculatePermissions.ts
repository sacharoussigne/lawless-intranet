import {
  can,
  resolvePermissions,
  toPermissionsObject,
  type ShelterPermissionsObject,
} from '@/lib/shelter/permissionsCatalog';

export function calculatePermissionsFromEffective(
  effectivePermissions: Iterable<string> | null | undefined,
): ShelterPermissionsObject | null {
  return toPermissionsObject(effectivePermissions);
}

export function calculatePermissions(role: string | null | undefined): ShelterPermissionsObject | null {
  if (!role) {
    return null;
  }
  return toPermissionsObject(resolvePermissions({ roles: role }));
}

export function hasPermission(
  effectivePermissions: Iterable<string> | null | undefined,
  resource: string,
  action: string,
): boolean {
  return can(effectivePermissions, resource, action);
}
