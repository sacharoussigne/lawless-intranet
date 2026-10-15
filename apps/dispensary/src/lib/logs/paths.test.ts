import { describe, expect, it } from 'vitest';
import { dispensarySlugFromPath, featureFromPath } from './paths';

describe('dispensarySlugFromPath', () => {
  it('reads the slug of page and API paths', () => {
    expect(dispensarySlugFromPath('/d/saint-denis/employee/stock')).toBe('saint-denis');
    expect(dispensarySlugFromPath('/api/d/saint-denis/read/items')).toBe('saint-denis');
    expect(dispensarySlugFromPath('/platform/users')).toBeNull();
    expect(dispensarySlugFromPath(null)).toBeNull();
  });
});

describe('featureFromPath', () => {
  it('maps pages to features', () => {
    expect(featureFromPath('/d/x/employee/stock-movements')).toBe('stock');
    expect(featureFromPath('/d/x/employee/weekly-activity')).toBe('weeklyDispensaryActivity');
    expect(featureFromPath('/d/x/employee/payroll/abc')).toBe('payroll');
    expect(featureFromPath('/d/x/admin/overwrite-stock')).toBe('stock');
    expect(featureFromPath('/d/x/management/items')).toBe('management');
    expect(featureFromPath('/d/x/management/mails')).toBe('mails');
    expect(featureFromPath('/platform/logs')).toBe('platform');
  });

  it('falls back to unknown', () => {
    expect(featureFromPath('/d/x/employee')).toBe('unknown');
    expect(featureFromPath('/somewhere')).toBe('unknown');
    expect(featureFromPath(undefined)).toBe('unknown');
  });
});
