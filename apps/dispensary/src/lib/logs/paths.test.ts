import { describe, expect, it } from 'vitest';
import { businessSlugFromPath, featureFromPath } from './paths';

describe('businessSlugFromPath', () => {
  it('reads the slug of page and API paths', () => {
    expect(businessSlugFromPath('/saint-denis/employee/stock')).toBe('saint-denis');
    expect(businessSlugFromPath('/api/d/saint-denis/read/items')).toBe('saint-denis');
    expect(businessSlugFromPath('/platform/users')).toBeNull();
    expect(businessSlugFromPath(null)).toBeNull();
  });
});

describe('featureFromPath', () => {
  it('maps pages to features', () => {
    expect(featureFromPath('/x/employee/stock-movements')).toBe('stock');
    expect(featureFromPath('/x/employee/weekly-activity')).toBe('weeklyActivity');
    expect(featureFromPath('/x/employee/payroll/abc')).toBe('payroll');
    expect(featureFromPath('/x/admin/overwrite-stock')).toBe('stock');
    expect(featureFromPath('/x/management/items')).toBe('management');
    expect(featureFromPath('/x/management/mails')).toBe('mails');
    expect(featureFromPath('/platform/logs')).toBe('platform');
  });

  it('falls back to unknown', () => {
    expect(featureFromPath('/x/employee')).toBe('unknown');
    expect(featureFromPath('/somewhere')).toBe('unknown');
    expect(featureFromPath(undefined)).toBe('unknown');
  });
});
