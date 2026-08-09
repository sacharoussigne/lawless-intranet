/** Application permission catalog (dispensary / business). Better Auth admin statements stay separate. */

export const applicationPermissionCatalog = {
  stock: ["view", "create", "update", "delete", "craft-read", "craft-write", "hide"],
  orders: ["view", "create", "update", "delete"],
  search: ["access"],
  bank: ["access"],
  application: ["access", "management"],
  mails: ["access"],
  payroll_reports: ["view", "create"],
  weekly_dispensary_activity: ["view", "edit_own", "edit_all"],
  sales: ["create", "cancel", "view", "view_all"],
  stock_statistics: ["view"],
} as const;

export type ApplicationResource = keyof typeof applicationPermissionCatalog;
export type ApplicationAction<R extends ApplicationResource = ApplicationResource> =
  (typeof applicationPermissionCatalog)[R][number];

export type PermissionKey = `${ApplicationResource}:${string}`;

export type RoleMatrix = Record<string, Partial<Record<ApplicationResource, readonly string[]>>>;

export type MemberPermissionOverride = {
  resource: string;
  action: string;
  effect: "grant" | "deny";
};

export type RolePermissionRow = {
  role: string;
  resource: string;
  action: string;
};

export function permissionKey(resource: string, action: string): PermissionKey {
  return `${resource}:${action}` as PermissionKey;
}

export function parsePermissionKey(key: string): { resource: string; action: string } | null {
  const idx = key.indexOf(":");
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

/** Default role → permissions matrix (seed source of truth). */
export const DEFAULT_ROLE_MATRIX: RoleMatrix = {
  user: {},
  admin: {
    stock: [...applicationPermissionCatalog.stock],
    orders: [...applicationPermissionCatalog.orders],
    search: [...applicationPermissionCatalog.search],
    bank: [...applicationPermissionCatalog.bank],
    application: [...applicationPermissionCatalog.application],
    mails: [...applicationPermissionCatalog.mails],
    payroll_reports: [...applicationPermissionCatalog.payroll_reports],
    weekly_dispensary_activity: [...applicationPermissionCatalog.weekly_dispensary_activity],
    sales: [...applicationPermissionCatalog.sales],
    stock_statistics: [...applicationPermissionCatalog.stock_statistics],
  },
  employee: {
    stock: ["view"],
    application: ["access"],
    mails: ["access"],
    weekly_dispensary_activity: ["view", "edit_own"],
    sales: ["create", "cancel", "view"],
  },
  inventory_manager: {
    stock: ["view", "create", "update", "delete", "craft-read", "craft-write"],
    orders: ["view", "create", "update", "delete"],
    search: ["access"],
    application: ["access", "management"],
    mails: ["access"],
    stock_statistics: ["view"],
    sales: ["create", "cancel", "view", "view_all"],
  },
  inventory_viewer: {
    stock: ["view", "craft-read"],
    search: ["access"],
    application: ["access"],
    sales: ["view"],
  },
  direction: {
    stock: ["view", "hide", "update"],
    orders: ["view", "create", "update", "delete"],
    bank: ["access"],
    application: ["access"],
    payroll_reports: ["view", "create"],
    weekly_dispensary_activity: ["view", "edit_all"],
    stock_statistics: ["view"],
    sales: ["create", "cancel", "view", "view_all"],
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
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}
