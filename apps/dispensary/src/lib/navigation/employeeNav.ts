import type { Icon } from '@tabler/icons-react';
import {
  IconAbacus,
  IconArchive,
  IconCalendarWeek,
  IconCashRegister,
  IconHistory,
  IconMail,
  IconNotebook,
  IconReceipt,
  IconReportMoney,
  IconSearch,
  IconStethoscope,
} from '@tabler/icons-react';
import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import { isAppFeatureEnabled } from '@/lib/appSettingsShared';
import { checkRolePermission } from '@lawless-intranet/auth-permissions';
import type { Permissions } from '@/types/permissions';
import type { tenantRoutes } from '@/types/routes';

export type EmployeeNavId =
  | 'stock'
  | 'orders'
  | 'bank'
  | 'cabinet'
  | 'weeklyActivity'
  | 'payroll'
  | 'sales'
  | 'stockStatistics'
  | 'stockMovements'
  | 'mails'
  | 'search';

export type EmployeeNavItem = {
  id: EmployeeNavId;
  label: string;
  shortLabel: string;
  href: string;
  icon: Icon;
  /** Lower = shown in primary bar first (max 4) */
  navOrder: number;
  iconOnly?: boolean;
};

export type EmployeeNavContext = {
  t: ReturnType<typeof tenantRoutes>;
  appSettings: AppSettingsDTO;
  permissions: Permissions | null;
  userRole: string | null;
  cabinetModuleAccess?: boolean;
  hasAccessibleChests?: boolean;
};

const PRIMARY_SLOT_COUNT = 4;

function isItemVisible(item: EmployeeNavItem, ctx: EmployeeNavContext): boolean {
  const { appSettings, permissions, userRole } = ctx;

  switch (item.id) {
    case 'stock':
      return (
        appSettings.featureStockEnabled &&
        (permissions?.stock.view ?? false) &&
        (ctx.hasAccessibleChests ?? false)
      );
    case 'orders':
      return (
        appSettings.featureOrdersEnabled &&
        checkRolePermission(userRole, 'orders', 'view')
      );
    case 'bank':
      return (
        appSettings.featureBankEnabled &&
        checkRolePermission(userRole, 'bank', 'access')
      );
    case 'cabinet':
      return (
        isAppFeatureEnabled(appSettings, 'cabinet') && (ctx.cabinetModuleAccess ?? false)
      );
    case 'weeklyActivity':
      return (
        appSettings.featureWeeklyDispensaryActivityEnabled &&
        (permissions?.weeklyDispensaryActivity.view ?? false)
      );
    case 'payroll':
      return (
        appSettings.featurePayrollEnabled && (permissions?.payrollReports.view ?? false)
      );
    case 'sales':
      return (
        isAppFeatureEnabled(appSettings, 'sales') &&
        (permissions?.sales.viewAll ?? false) &&
        (ctx.hasAccessibleChests ?? false)
      );
    case 'stockStatistics':
    case 'stockMovements':
      return (
        appSettings.featureStockEnabled && (permissions?.stockStatistics.view ?? false)
      );
    case 'mails':
      return (
        appSettings.featureMailsEnabled &&
        checkRolePermission(userRole, 'mails', 'access')
      );
    case 'search':
      return (
        appSettings.featureSearchEnabled &&
        checkRolePermission(userRole, 'search', 'access')
      );
    default:
      return false;
  }
}

function buildAllItems(ctx: EmployeeNavContext): EmployeeNavItem[] {
  const { t } = ctx;
  return [
    {
      id: 'stock',
      label: 'Stocks',
      shortLabel: 'Stock',
      href: t.stock.index,
      icon: IconArchive,
      navOrder: 1,
    },
    {
      id: 'orders',
      label: 'Commandes',
      shortLabel: 'Commandes',
      href: t.orders.index,
      icon: IconNotebook,
      navOrder: 2,
    },
    {
      id: 'bank',
      label: 'Banque',
      shortLabel: 'Banque',
      href: t.bank.index,
      icon: IconCashRegister,
      navOrder: 3,
    },
    {
      id: 'cabinet',
      label: 'Cabinet',
      shortLabel: 'Cabinet',
      href: t.cabinet.index,
      icon: IconStethoscope,
      navOrder: 17,
    },
    {
      id: 'weeklyActivity',
      label: 'Activité hebdo',
      shortLabel: 'Activité',
      href: t.weeklyActivity.index,
      icon: IconCalendarWeek,
      navOrder: 10,
    },
    {
      id: 'payroll',
      label: 'Salaires',
      shortLabel: 'Salaires',
      href: t.employee.payroll,
      icon: IconReportMoney,
      navOrder: 11,
    },
    {
      id: 'sales',
      label: 'Ventes',
      shortLabel: 'Ventes',
      href: t.employee.sales,
      icon: IconReceipt,
      navOrder: 12,
    },
    {
      id: 'stockStatistics',
      label: 'Stats stock',
      shortLabel: 'Stats',
      href: t.employee.stockStatistics,
      icon: IconAbacus,
      navOrder: 13,
    },
    {
      id: 'stockMovements',
      label: 'Historique stock',
      shortLabel: 'Historique',
      href: t.employee.stockMovements,
      icon: IconHistory,
      navOrder: 14,
    },
    {
      id: 'mails',
      label: 'Courriers',
      shortLabel: 'Courriers',
      href: t.employee.mails,
      icon: IconMail,
      navOrder: 15,
    },
    {
      id: 'search',
      label: 'Recherche',
      shortLabel: 'Recherche',
      href: t.searchItems.index,
      icon: IconSearch,
      navOrder: 16,
      iconOnly: true,
    },
  ];
}

export function getEmployeeNavItems(ctx: EmployeeNavContext): {
  primary: EmployeeNavItem[];
  more: EmployeeNavItem[];
  search: EmployeeNavItem | null;
} {
  const visible = buildAllItems(ctx)
    .filter((item) => isItemVisible(item, ctx))
    .sort((a, b) => a.navOrder - b.navOrder);

  const search = visible.find((item) => item.id === 'search') ?? null;
  const withoutSearch = visible.filter((item) => item.id !== 'search');

  const primary = withoutSearch.slice(0, PRIMARY_SLOT_COUNT);
  const primaryIds = new Set(primary.map((i) => i.id));
  const more = withoutSearch.filter((i) => !primaryIds.has(i.id));

  return { primary, more, search };
}
