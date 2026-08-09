import {
  DEFAULT_ROLE_MATRIX,
  listCatalogPermissionKeys,
  parseRoleNames,
  permissionKey,
  type ApplicationResource,
  type MemberPermissionOverride,
  type PermissionKey,
  type RoleMatrix,
  type RolePermissionRow,
} from "./catalog";

export type ResolvePermissionsInput = {
  roles: string | string[] | null | undefined;
  roleMatrix?: RoleMatrix | RolePermissionRow[];
  overrides?: MemberPermissionOverride[];
  /** When true (e.g. platform admin bypass), grant the full catalog. */
  grantAll?: boolean;
};

function toRoleMatrix(matrix?: RoleMatrix | RolePermissionRow[]): RoleMatrix {
  if (!matrix) {
    return DEFAULT_ROLE_MATRIX;
  }
  if (Array.isArray(matrix)) {
    const result: RoleMatrix = {};
    for (const row of matrix) {
      if (!result[row.role]) {
        result[row.role] = {};
      }
      const resourceMap = result[row.role]!;
      const current = resourceMap[row.resource as ApplicationResource] ?? [];
      if (!(current as readonly string[]).includes(row.action)) {
        resourceMap[row.resource as ApplicationResource] = [...current, row.action];
      }
    }
    return result;
  }
  return matrix;
}

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
    if (override.effect === "grant") {
      effective.add(key);
    } else if (override.effect === "deny") {
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

export function checkRolePermissionAgainstMatrix(
  roleName: string | null | undefined,
  resource: string,
  action: string,
  roleMatrix: RoleMatrix = DEFAULT_ROLE_MATRIX,
): boolean {
  const effective = resolvePermissions({ roles: roleName, roleMatrix });
  return can(effective, resource, action);
}

export type PermissionsObject = {
  stock: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    craftRead: boolean;
    craftWrite: boolean;
    hide: boolean;
  };
  orders: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  search: {
    access: boolean;
  };
  bank: {
    access: boolean;
  };
  application: {
    access: boolean;
    management: boolean;
  };
  mails: {
    access: boolean;
  };
  payrollReports: {
    view: boolean;
    create: boolean;
  };
  weeklyDispensaryActivity: {
    view: boolean;
    editOwn: boolean;
    editAll: boolean;
  };
  stockStatistics: {
    view: boolean;
  };
  sales: {
    create: boolean;
    cancel: boolean;
    view: boolean;
    viewAll: boolean;
  };
};

export function toPermissionsObject(
  effective: Iterable<string> | null | undefined,
): PermissionsObject | null {
  if (!effective) {
    return null;
  }
  const has = (resource: string, action: string) => can(effective, resource, action);
  return {
    stock: {
      view: has("stock", "view"),
      create: has("stock", "create"),
      update: has("stock", "update"),
      delete: has("stock", "delete"),
      craftRead: has("stock", "craft-read"),
      craftWrite: has("stock", "craft-write"),
      hide: has("stock", "hide"),
    },
    orders: {
      view: has("orders", "view"),
      create: has("orders", "create"),
      update: has("orders", "update"),
      delete: has("orders", "delete"),
    },
    search: {
      access: has("search", "access"),
    },
    bank: {
      access: has("bank", "access"),
    },
    application: {
      access: has("application", "access"),
      management: has("application", "management"),
    },
    mails: {
      access: has("mails", "access"),
    },
    payrollReports: {
      view: has("payroll_reports", "view"),
      create: has("payroll_reports", "create"),
    },
    weeklyDispensaryActivity: {
      view: has("weekly_dispensary_activity", "view"),
      editOwn: has("weekly_dispensary_activity", "edit_own"),
      editAll: has("weekly_dispensary_activity", "edit_all"),
    },
    stockStatistics: {
      view: has("stock_statistics", "view"),
    },
    sales: {
      create: has("sales", "create"),
      cancel: has("sales", "cancel"),
      view: has("sales", "view"),
      viewAll: has("sales", "view_all"),
    },
  };
}
