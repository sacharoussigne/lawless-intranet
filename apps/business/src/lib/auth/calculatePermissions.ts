import {
  can,
  resolvePermissions,
  toPermissionsObject,
  type PermissionsObject,
} from '@lawless-intranet/auth-permissions';

/**
 * Builds the UI permissions object from already-resolved effective permission keys.
 */
export function calculatePermissionsFromEffective(
  effectivePermissions: Iterable<string> | null | undefined,
): PermissionsObject | null {
  return toPermissionsObject(effectivePermissions);
}

/**
 * Falls back to code DEFAULT_ROLE_MATRIX when only a role string is available.
 * Prefer calculatePermissionsFromEffective with tenant-resolved keys.
 */
export function calculatePermissions(role: string | null | undefined): PermissionsObject | null {
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
