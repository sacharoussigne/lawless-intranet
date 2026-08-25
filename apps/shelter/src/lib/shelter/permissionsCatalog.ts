/** Shelter application permission catalog (slim — not the dispensary catalog). */

export const applicationPermissionCatalog = {
  application: ['access', 'management'],
  bank: ['access'],
  species: ['manage'],
  animals: ['access', 'update', 'create', 'updateCore', 'delete'],
  documentTemplates: ['manage'],
} as const;

export type ApplicationResource = keyof typeof applicationPermissionCatalog;
export type ApplicationAction<R extends ApplicationResource = ApplicationResource> =
  (typeof applicationPermissionCatalog)[R][number];

export type PermissionKey = `${ApplicationResource}:${string}`;

export type RoleMatrix = Record<string, Partial<Record<ApplicationResource, readonly string[]>>>;

export type MemberPermissionOverride = {
  resource: string;
  action: string;
  effect: 'grant' | 'deny';
};

export type RolePermissionRow = {
  role: string;
  resource: string;
  action: string;
};

export const SHELTER_MEMBER_ROLES = ['admin', 'direction', 'employee'] as const;
export type ShelterMemberRole = (typeof SHELTER_MEMBER_ROLES)[number];

export function permissionKey(resource: string, action: string): PermissionKey {
  return `${resource}:${action}` as PermissionKey;
}

export function parsePermissionKey(key: string): { resource: string; action: string } | null {
  const idx = key.indexOf(':');
  if (idx <= 0 || idx === key.length - 1) {
    return null;
  }
  return { resource: key.slice(0, idx), action: key.slice(idx + 1) };
}

export function listCatalogPermissionKeys(): PermissionKey[] {
  const keys: PermissionKey[] = [];
  for (const [resource, actions] of Object.entries(applicationPermissionCatalog)) {
    for (const action of actions) {
      keys.push(permissionKey(resource, action));
    }
  }
  return keys;
}

export function isCatalogPermission(resource: string, action: string): boolean {
  const actions = applicationPermissionCatalog[resource as ApplicationResource];
  if (!actions) {
    return false;
  }
  return (actions as readonly string[]).includes(action);
}

export const DEFAULT_ROLE_MATRIX: RoleMatrix = {
  admin: {
    application: [...applicationPermissionCatalog.application],
    bank: [...applicationPermissionCatalog.bank],
    species: [...applicationPermissionCatalog.species],
    animals: [...applicationPermissionCatalog.animals],
    documentTemplates: [...applicationPermissionCatalog.documentTemplates],
  },
  direction: {
    application: ['access'],
    bank: ['access'],
    species: [...applicationPermissionCatalog.species],
    animals: [...applicationPermissionCatalog.animals],
    documentTemplates: [...applicationPermissionCatalog.documentTemplates],
  },
  employee: {
    application: ['access'],
    animals: ['access', 'update'],
  },
};

export function flattenRoleMatrix(matrix: RoleMatrix): RolePermissionRow[] {
  const rows: RolePermissionRow[] = [];
  for (const [role, resources] of Object.entries(matrix)) {
    for (const [resource, actions] of Object.entries(resources ?? {})) {
      for (const action of actions ?? []) {
        rows.push({ role, resource, action });
      }
    }
  }
  return rows;
}

export function roleMatrixFromRows(rows: RolePermissionRow[]): RoleMatrix {
  const matrix: RoleMatrix = {};
  for (const row of rows) {
    if (!matrix[row.role]) {
      matrix[row.role] = {};
    }
    const resourceMap = matrix[row.role]!;
    const current = resourceMap[row.resource as ApplicationResource] ?? [];
    if (!(current as readonly string[]).includes(row.action)) {
      resourceMap[row.resource as ApplicationResource] = [...current, row.action];
    }
  }
  return matrix;
}

export function parseRoleNames(roleName: string | null | undefined): string[] {
  if (!roleName) {
    return [];
  }
  return roleName
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

export type ResolvePermissionsInput = {
  roles: string | string[] | null | undefined;
  roleMatrix?: RoleMatrix | RolePermissionRow[];
  overrides?: MemberPermissionOverride[];
  grantAll?: boolean;
};

function toRoleMatrix(matrix?: RoleMatrix | RolePermissionRow[]): RoleMatrix {
  if (!matrix) {
    return DEFAULT_ROLE_MATRIX;
  }
  if (Array.isArray(matrix)) {
    return roleMatrixFromRows(matrix);
  }
  return matrix;
}

/** Resolve effective permissions against the shelter catalog (never dispensary grantAll). */
export function resolvePermissions(input: ResolvePermissionsInput): Set<PermissionKey> {
  if (input.grantAll) {
    return new Set(listCatalogPermissionKeys());
  }

  const roles = Array.isArray(input.roles)
    ? input.roles.map((r) => r.trim()).filter(Boolean)
    : parseRoleNames(input.roles);
  const matrix = toRoleMatrix(input.roleMatrix);
  const effective = new Set<PermissionKey>();

  for (const role of roles) {
    const resources = matrix[role];
    if (!resources) {
      continue;
    }
    for (const [resource, actions] of Object.entries(resources)) {
      for (const action of actions ?? []) {
        effective.add(permissionKey(resource, action));
      }
    }
  }

  for (const override of input.overrides ?? []) {
    const key = permissionKey(override.resource, override.action);
    if (override.effect === 'grant') {
      effective.add(key);
    } else if (override.effect === 'deny') {
      effective.delete(key);
    }
  }

  return effective;
}

export function can(
  effective: Iterable<string> | null | undefined,
  resource: string,
  action: string,
): boolean {
  if (!effective) {
    return false;
  }
  const key = permissionKey(resource, action);
  if (effective instanceof Set) {
    return effective.has(key);
  }
  for (const item of effective) {
    if (item === key) {
      return true;
    }
  }
  return false;
}

export type ShelterPermissionsObject = {
  application: {
    access: boolean;
    management: boolean;
  };
  bank: {
    access: boolean;
  };
  species: {
    manage: boolean;
  };
  animals: {
    access: boolean;
    update: boolean;
    create: boolean;
    updateCore: boolean;
    delete: boolean;
  };
  documentTemplates: {
    manage: boolean;
  };
};

export function toPermissionsObject(
  effective: Iterable<string> | null | undefined,
): ShelterPermissionsObject | null {
  if (!effective) {
    return null;
  }
  const has = (resource: string, action: string) => can(effective, resource, action);
  return {
    application: {
      access: has('application', 'access'),
      management: has('application', 'management'),
    },
    bank: {
      access: has('bank', 'access'),
    },
    species: {
      manage: has('species', 'manage'),
    },
    animals: {
      access: has('animals', 'access'),
      update: has('animals', 'update'),
      create: has('animals', 'create'),
      updateCore: has('animals', 'updateCore'),
      delete: has('animals', 'delete'),
    },
    documentTemplates: {
      manage: has('documentTemplates', 'manage'),
    },
  };
}
