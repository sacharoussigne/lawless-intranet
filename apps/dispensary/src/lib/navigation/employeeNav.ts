import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import { isAppFeatureEnabled } from '@/lib/appSettingsShared';
import type { Permissions } from '@/types/permissions';
import type { tenantRoutes } from '@/types/routes';
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

export type EmployeeNavId =
  | 'stock'
  | 'orders'
  | 'bank'
  | 'cabinet'
  | 'activity'
  | 'mails'
  | 'search';

/** Pages grouped behind one header link, shown as tabs (see SectionTabs). */
export type EmployeeSectionId = 'stock' | 'activity';

export type EmployeeSectionTab = {
  id: 'inventory' | 'movements' | 'statistics' | 'weeklyActivity' | 'sales' | 'payroll';
  label: string;
  href: string;
  icon: Icon;
};

export type EmployeeNavItem = {
  id: EmployeeNavId;
  label: string;
  shortLabel: string;
  href: string;
  icon: Icon;
  /** Lower = shown in primary bar first */
  navOrder: number;
  iconOnly?: boolean;
  /** Section links: every tab URL, so the link stays active on all of them. */
  activeHrefs?: string[];
};

export type EmployeeNavContext = {
  t: ReturnType<typeof tenantRoutes>;
  appSettings: AppSettingsDTO;
  permissions: Permissions | null;
  userRole: string | null;
  cabinetModuleAccess?: boolean;
  hasAccessibleChests?: boolean;
};

/** Links shown in the bar; the others go in « Plus ». */
const PRIMARY_SLOT_COUNT = 4;

function canViewStock(ctx: EmployeeNavContext): boolean {
  return (
    ctx.appSettings.featureStockEnabled &&
    (ctx.permissions?.stock.view ?? false) &&
    (ctx.hasAccessibleChests ?? false)
  );
}

function canViewStockStatistics(ctx: EmployeeNavContext): boolean {
  return ctx.appSettings.featureStockEnabled && (ctx.permissions?.stockStatistics.view ?? false);
}

/** Visible tabs of a section, in display order. */
export function getEmployeeSectionTabs(
  ctx: EmployeeNavContext,
  section: EmployeeSectionId,
): EmployeeSectionTab[] {
  const { t, appSettings, permissions } = ctx;
  const tabs: (EmployeeSectionTab & { visible: boolean })[] =
    section === 'stock'
      ? [
          { id: 'inventory', label: 'Inventaire', href: t.stock.index, icon: IconArchive, visible: canViewStock(ctx) },
          {
            id: 'movements',
            label: 'Mouvements',
            href: t.employee.stockMovements,
            icon: IconHistory,
            visible: canViewStockStatistics(ctx),
          },
          {
            id: 'statistics',
            label: 'Statistiques',
            href: t.employee.stockStatistics,
            icon: IconAbacus,
            visible: canViewStockStatistics(ctx),
          },
        ]
      : [
          {
            id: 'weeklyActivity',
            label: 'Activité hebdo',
            href: t.weeklyActivity.index,
            icon: IconCalendarWeek,
            visible:
              appSettings.featureWeeklyDispensaryActivityEnabled &&
              (permissions?.weeklyDispensaryActivity.view ?? false),
          },
          {
            id: 'payroll',
            label: 'Salaires',
            href: t.employee.payroll,
            icon: IconReportMoney,
            visible: appSettings.featurePayrollEnabled && (permissions?.payrollReports.view ?? false),
          },
          {
            id: 'sales',
            label: 'Ventes',
            href: t.employee.sales,
            icon: IconReceipt,
            visible: isAppFeatureEnabled(appSettings, 'sales') && (permissions?.sales.viewAll ?? false),
          },
        ];
  return tabs.filter((tab) => tab.visible).map(({ visible: _visible, ...tab }) => tab);
}

/** Header link of a section: first visible tab, active on every tab. */
function sectionItem(
  ctx: EmployeeNavContext,
  section: EmployeeSectionId,
  item: Omit<EmployeeNavItem, 'id' | 'href' | 'activeHrefs'>,
): EmployeeNavItem | null {
  const tabs = getEmployeeSectionTabs(ctx, section);
  const [first] = tabs;
  if (!first) return null;
  return { ...item, id: section, href: first.href, activeHrefs: tabs.map((tab) => tab.href) };
}

function isItemVisible(item: EmployeeNavItem, ctx: EmployeeNavContext): boolean {
  const { appSettings, permissions } = ctx;

  switch (item.id) {
    case 'orders':
      return appSettings.featureOrdersEnabled && (permissions?.orders.view ?? false);
    case 'bank':
      return appSettings.featureBankEnabled && (permissions?.bank.access ?? false);
    case 'cabinet':
      return (
        isAppFeatureEnabled(appSettings, 'cabinet') && (ctx.cabinetModuleAccess ?? false)
      );
    case 'mails':
      return appSettings.featureMailsEnabled && (permissions?.mails.access ?? false);
    case 'search':
      return appSettings.featureSearchEnabled && (permissions?.search.access ?? false);
    default:
      return false;
  }
}

function buildAllItems(ctx: EmployeeNavContext): EmployeeNavItem[] {
  const { t } = ctx;
  const sections = [
    sectionItem(ctx, 'stock', { label: 'Stocks', shortLabel: 'Stock', icon: IconArchive, navOrder: 1 }),
    sectionItem(ctx, 'activity', {
      label: 'Activité',
      shortLabel: 'Activité',
      icon: IconCalendarWeek,
      navOrder: 10,
    }),
  ].filter((item): item is EmployeeNavItem => item !== null);

  const links: EmployeeNavItem[] = [
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
  return [...sections, ...links.filter((item) => isItemVisible(item, ctx))];
}

export function getEmployeeNavItems(ctx: EmployeeNavContext): {
  primary: EmployeeNavItem[];
  more: EmployeeNavItem[];
  search: EmployeeNavItem | null;
} {
  const visible = buildAllItems(ctx).sort((a, b) => a.navOrder - b.navOrder);

  const search = visible.find((item) => item.id === 'search') ?? null;
  const withoutSearch = visible.filter((item) => item.id !== 'search');

  const primary = withoutSearch.slice(0, PRIMARY_SLOT_COUNT);
  const primaryIds = new Set(primary.map((i) => i.id));
  const more = withoutSearch.filter((i) => !primaryIds.has(i.id));

  return { primary, more, search };
}
