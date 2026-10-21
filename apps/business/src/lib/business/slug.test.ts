import { describe, expect, it } from 'vitest';
import {
  isReservedBusinessSlug,
  parseBusinessSlugFromPathname,
  rewritePathWithBusinessSlug,
  slugifyBusinessName,
} from '@/lib/business/slug';
import {
  legacyPathToTenant,
  oldEmployeeModulePathToCanonical,
  prefixedBusinessPathToCanonical,
  tenantRoutes,
} from '@/types/routes';

describe('business paths', () => {
  it('live at /<slug>/…', () => {
    expect(tenantRoutes('saint-denis').employee.index).toBe('/saint-denis/employee');
    expect(parseBusinessSlugFromPathname('/saint-denis/employee/stock')).toBe('saint-denis');
    expect(parseBusinessSlugFromPathname('/saint-denis')).toBe('saint-denis');
  });

  it('never take a path of the app', () => {
    for (const path of ['/', '/platform/users', '/settings', '/auth/login', '/api/d/x/read', '/d/x/employee', '/favicon.ico']) {
      expect(parseBusinessSlugFromPathname(path)).toBeNull();
    }
    expect(isReservedBusinessSlug('platform')).toBe(true);
    expect(isReservedBusinessSlug('Stock')).toBe(true);
    expect(isReservedBusinessSlug('valentine')).toBe(false);
    expect(slugifyBusinessName('Platform')).toBe('platform-1');
    expect(slugifyBusinessName('Saint-Denis')).toBe('saint-denis');
  });

  it('switch business on the same page', () => {
    expect(rewritePathWithBusinessSlug('/saint-denis/employee/stock?x=1', 'valentine')).toBe(
      '/valentine/employee/stock?x=1',
    );
    expect(rewritePathWithBusinessSlug('/settings', 'valentine')).toBe('/valentine/employee');
  });

  it('redirect the old paths', () => {
    expect(prefixedBusinessPathToCanonical('/d/saint-denis/employee/stock')).toBe(
      '/saint-denis/employee/stock',
    );
    expect(prefixedBusinessPathToCanonical('/d/saint-denis')).toBe('/saint-denis');
    expect(prefixedBusinessPathToCanonical('/saint-denis/employee')).toBeNull();
    expect(legacyPathToTenant('/stock', 'saint-denis')).toBe('/saint-denis/employee/stock');
    expect(oldEmployeeModulePathToCanonical('/saint-denis/stock')).toBe('/saint-denis/employee/stock');
  });
});
