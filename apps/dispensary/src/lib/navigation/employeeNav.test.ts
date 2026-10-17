import { describe, expect, it } from 'vitest';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import type { Permissions } from '@/types/permissions';
import { tenantRoutes } from '@/types/routes';
import { getEmployeeNavItems, getEmployeeSectionTabs, type EmployeeNavContext } from './employeeNav';

const t = tenantRoutes('saint-denis');

/** Only the permissions read by the nav. */
function permissions(granted: {
  stock?: boolean;
  stats?: boolean;
  weekly?: boolean;
  sales?: boolean;
  payroll?: boolean;
  others?: boolean;
}): Permissions {
  const others = granted.others ?? false;
  return {
    stock: { view: granted.stock ?? false },
    stockStatistics: { view: granted.stats ?? false },
    weeklyDispensaryActivity: { view: granted.weekly ?? false },
    sales: { viewAll: granted.sales ?? false },
    payrollReports: { view: granted.payroll ?? false },
    orders: { view: others },
    bank: { access: others },
    mails: { access: others },
    search: { access: others },
  } as unknown as Permissions;
}

function ctx(perms: Permissions): EmployeeNavContext {
  return {
    t,
    appSettings: APP_SETTINGS_DEFAULTS,
    permissions: perms,
    userRole: null,
    cabinetModuleAccess: true,
    hasAccessibleChests: true,
  };
}

const everything = permissions({ stock: true, stats: true, weekly: true, sales: true, payroll: true, others: true });

describe('employee nav', () => {
  it('groups stock and activity pages: 4 links, the rest in « Plus », plus search', () => {
    const { primary, more, search } = getEmployeeNavItems(ctx(everything));
    expect(primary.map((item) => item.id)).toEqual(['stock', 'orders', 'bank', 'activity']);
    expect(more.map((item) => item.id)).toEqual(['mails', 'cabinet']);
    expect(search?.id).toBe('search');
  });

  it('makes a section link active on every visible tab', () => {
    const stock = getEmployeeNavItems(ctx(everything)).primary.find((item) => item.id === 'stock');
    expect(stock?.href).toBe(t.stock.index);
    expect(stock?.activeHrefs).toEqual([t.stock.index, t.employee.stockMovements, t.employee.stockStatistics]);
  });

  it('points a section to its first visible tab', () => {
    const statsOnly = ctx(permissions({ stats: true }));
    expect(getEmployeeSectionTabs(statsOnly, 'stock').map((tab) => tab.id)).toEqual(['movements', 'statistics']);
    expect(getEmployeeNavItems(statsOnly).primary.find((item) => item.id === 'stock')?.href).toBe(
      t.employee.stockMovements,
    );
  });

  it('hides tabs and sections without permission', () => {
    const noPayroll = ctx(permissions({ weekly: true, sales: true }));
    expect(getEmployeeSectionTabs(noPayroll, 'activity').map((tab) => tab.id)).toEqual(['weeklyActivity', 'sales']);
    const nothing = getEmployeeNavItems(ctx(permissions({})));
    expect(nothing.primary.map((item) => item.id)).toEqual(['cabinet']);
  });
});
