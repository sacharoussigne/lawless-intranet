import { createAccessControl } from "better-auth/plugins";
import { defaultStatements, adminAc, userAc } from "better-auth/plugins/admin/access";

const defaultApplicationPermissions = {
  stock: ["view", "create", "update", "delete", "craft-read", "craft-write"],
  orders: ["view", "create", "update", "delete"],
  search: ["access"],
  bank: ["access"],
  application: ["access", "management"],
  mails: ["access"],
  payroll_reports: ["view", "create"],
  weekly_dispensary_activity: ["view", "edit_own", "edit_all"],
  sales: ["create", "cancel", "view", "view_all"],
};

export const statement = {
  ...defaultStatements,
  ...defaultApplicationPermissions,
  stock_statistics: ["view"],
} as const;

const ac = createAccessControl(statement);

const user = ac.newRole({
  ...userAc.statements,
  stock: [],
  orders: [],
  search: [],
  bank: [],
  application: [],
  mails: [],
  payroll_reports: [],
  weekly_dispensary_activity: [],
  stock_statistics: [],
  sales: [],
});

const admin = ac.newRole({
  ...adminAc.statements,
  ...defaultApplicationPermissions,
  stock_statistics: ["view"],
});

const employee = ac.newRole({
  ...userAc.statements,
  orders: ["view"],
  bank: ["access"],
  application: ["access"],
  mails: ["access"],
  payroll_reports: [],
  weekly_dispensary_activity: ["view", "edit_own"],
  stock_statistics: [],
  sales: ["create", "cancel", "view"],
});

const inventory_manager = ac.newRole({
  ...userAc.statements,
  stock: ["view", "create", "update", "delete", "craft-read", "craft-write"],
  orders: ["view", "create", "update", "delete"],
  search: ["access"],
  bank: ["access"],
  application: ["access", "management"],
  mails: ["access"],
  payroll_reports: [],
  weekly_dispensary_activity: [],
  stock_statistics: ["view"],
  sales: ["create", "cancel", "view", "view_all"],
});

const inventory_viewer = ac.newRole({
  ...userAc.statements,
  stock: ["view", "craft-read"],
  orders: ["view"],
  search: ["access"],
  bank: ["access"],
  application: ["access"],
  mails: [],
  payroll_reports: [],
  weekly_dispensary_activity: [],
  stock_statistics: [],
  sales: ["view"],
});

const direction = ac.newRole({
  ...userAc.statements,
  stock: [],
  orders: [],
  search: [],
  bank: [],
  application: ["access"],
  mails: [],
  payroll_reports: ["view", "create"],
  weekly_dispensary_activity: ["view", "edit_all"],
  stock_statistics: ["view"],
  sales: ["create", "cancel", "view", "view_all"],
});

const rolesMap = {
  user,
  admin,
  employee,
  inventory_manager,
  inventory_viewer,
  direction,
} as const;

export function checkRolePermission(
  roleName: string | null | undefined,
  resource: keyof typeof statement,
  action: string,
): boolean {
  if (!roleName) {
    return false;
  }

  const roles = roleName
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  for (const role of roles) {
    const roleObj = rolesMap[role as keyof typeof rolesMap];
    if (!roleObj) {
      continue;
    }

    const resourcePermissions =
      roleObj.statements[resource as keyof typeof roleObj.statements];
    if (!resourcePermissions) {
      continue;
    }

    if ((resourcePermissions as readonly string[]).includes(action)) {
      return true;
    }
  }

  return false;
}

export function hasRole(
  roleName: string | null | undefined,
  roleToCheck: keyof typeof rolesMap | string,
): boolean {
  if (!roleName) {
    return false;
  }

  const roles = roleName
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const target = String(roleToCheck).trim();

  return roles.includes(target);
}

export {
  ac,
  user,
  admin,
  employee,
  inventory_manager,
  inventory_viewer,
  direction,
};
