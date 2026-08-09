import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_DISPENSARY_SLUG } from '@/lib/dispensary/constants';
import type { FormEntityType } from '@/lib/cabinet/formSchema';

export function dispensaryBase(slug: string): string {
  return `/d/${encodeURIComponent(slug)}`;
}

/** Employee module segments that used to live at /d/:slug/<seg> and now live under /employee. */
export const EMPLOYEE_MODULE_SEGMENTS = [
  'stock',
  'orders',
  'search-items',
  'bank',
  'weekly-activity',
  'agenda',
  'cabinet',
] as const;

export type EmployeeModuleSegment = (typeof EMPLOYEE_MODULE_SEGMENTS)[number];

export function tenantRoutes(slug: string) {
  const base = dispensaryBase(slug);
  const employeeBase = `${base}/employee`;
  return {
    employee: {
      index: employeeBase,
      payroll: `${employeeBase}/payroll`,
      payrollNew: `${employeeBase}/payroll/new`,
      payrollDetail: (id: string) => `${employeeBase}/payroll/${id}`,
      stockStatistics: `${employeeBase}/stock-statistics`,
      stockMovements: `${employeeBase}/stock-movements`,
      sales: `${employeeBase}/sales`,
      mails: `${employeeBase}/mails`,
      newMail: `${employeeBase}/mails/new`,
      editMail: (id: string) => `${employeeBase}/mails/${id}/edit`,
      newTemplate: `${employeeBase}/mails/templates/new`,
      editTemplate: (id: string) => `${employeeBase}/mails/templates/${id}/edit`,
      testTemplate: (id: string) => `${employeeBase}/mails/templates/${id}/test`,
    },
    stock: { index: `${employeeBase}/stock` },
    orders: { index: `${employeeBase}/orders` },
    searchItems: { index: `${employeeBase}/search-items` },
    bank: { index: `${employeeBase}/bank` },
    weeklyActivity: { index: `${employeeBase}/weekly-activity` },
    agenda: { index: `${employeeBase}/agenda` },
    cabinet: {
      index: `${employeeBase}/cabinet`,
      forms: (cabinetId: string, tab?: FormEntityType) => {
        const params = new URLSearchParams({ cabinetId });
        if (tab) params.set('tab', tab);
        return `${employeeBase}/cabinet/forms?${params.toString()}`;
      },
      templates: (cabinetId: string) =>
        `${employeeBase}/cabinet/templates?cabinetId=${encodeURIComponent(cabinetId)}`,
      newTemplate: (cabinetId: string) =>
        `${employeeBase}/cabinet/templates/new?cabinetId=${encodeURIComponent(cabinetId)}`,
      editTemplate: (cabinetId: string, id: string) =>
        `${employeeBase}/cabinet/templates/${encodeURIComponent(id)}/edit?cabinetId=${encodeURIComponent(cabinetId)}`,
    },
    management: {
      index: `${base}/management`,
      companies: (tab?: 'groups') => {
        const url = `${base}/management/companies`;
        if (tab === 'groups') return `${url}?tab=groups`;
        return url;
      },
      items: (tab?: 'categories') => {
        const url = `${base}/management/items`;
        if (tab === 'categories') return `${url}?tab=categories`;
        return url;
      },
      mails: `${base}/management/mails`,
      chests: `${base}/management/chests`,
    },
    admin: {
      index: `${base}/admin`,
      settings: `${base}/admin/settings`,
      members: `${base}/admin/members`,
      overwriteStock: `${base}/admin/overwrite-stock`,
      payroll: `${base}/admin/payroll`,
      payrollNew: `${base}/admin/payroll/new`,
      payrollDetail: (id: string) => `${base}/admin/payroll/${id}`,
      agendas: `${base}/admin/agendas`,
      cabinets: `${base}/admin/cabinets`,
    },
  };
}

export const routes = {
  test: {
    index: '/test',
  },
  platform: {
    dispensaries: '/platform/dispensaries',
    users: '/platform/users',
  },
  api: {},
  settings: {
    index: '/settings',
  },
  auth: {
    index: '/auth',
    login: '/auth/login',
    logout: '/auth/logout',
    register: '/auth/register',
    resetPassword: '/auth/reset-password',
    verifyEmail: '/auth/verify-email',
    noAccess: '/auth/no-access',
    noManagementAccess: '/auth/no-management-access',
    noDispensaryAccess: '/auth/no-dispensary-access',
  },
  redirect: (request: NextRequest, route: string) => {
    return NextResponse.redirect(new URL(route, request.url));
  },
};

const LEGACY_TO_EMPLOYEE_PREFIX = new Set<string>(EMPLOYEE_MODULE_SEGMENTS);

export const LEGACY_TENANT_PATHS = [
  '/stock',
  '/orders',
  '/search-items',
  '/bank',
  '/weekly-activity',
  '/agenda',
  '/cabinet',
  '/employee',
  '/management',
  '/admin/settings',
  '/admin/overwrite-stock',
  '/admin/payroll',
] as const;

function tenantPathForLegacy(legacyPath: string, slug: string): string {
  const segment = legacyPath.slice(1); // without leading /
  if (LEGACY_TO_EMPLOYEE_PREFIX.has(segment)) {
    return `/d/${slug}/employee${legacyPath}`;
  }
  return `/d/${slug}${legacyPath}`;
}

export function legacyPathToTenant(pathname: string, slug: string = DEFAULT_DISPENSARY_SLUG): string | null {
  for (const legacy of LEGACY_TENANT_PATHS) {
    if (pathname === legacy) {
      return tenantPathForLegacy(legacy, slug);
    }
    if (pathname.startsWith(`${legacy}/`)) {
      const segment = legacy.slice(1);
      if (LEGACY_TO_EMPLOYEE_PREFIX.has(segment)) {
        return `/d/${slug}/employee${pathname}`;
      }
      return `/d/${slug}${pathname}`;
    }
  }
  if (pathname.startsWith('/platform')) {
    return null;
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (pathname === '/admin/users' || pathname.startsWith('/admin/users/')) {
      return `/platform/users${pathname.slice('/admin/users'.length)}`;
    }
    return `/d/${slug}${pathname}`;
  }
  return null;
}

/**
 * Redirect /d/:slug/(stock|orders|...)[/...] → /d/:slug/employee/(stock|orders|...)[/...]
 * Returns null if the path is already canonical or unrelated.
 */
export function oldEmployeeModulePathToCanonical(pathname: string): string | null {
  const match = pathname.match(/^\/d\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const [, slug, segment, rest = ''] = match;
  if (!(EMPLOYEE_MODULE_SEGMENTS as readonly string[]).includes(segment)) {
    return null;
  }
  return `/d/${slug}/employee/${segment}${rest}`;
}
