import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/appSettings', () => ({ getAppSettings: vi.fn() }));

const { defaultCaisseUnitForReport } = await import('@/lib/payroll/salaryTypes');

describe('defaultCaisseUnitForReport', () => {
  const rates = { caisseUnitUsd: 6.5, cashPreparerCaisseUnitUsd: 4 };

  it('takes the default of the kind of report', () => {
    expect(defaultCaisseUnitForReport(rates, 'Employés')).toBe(6.5);
    expect(defaultCaisseUnitForReport(rates, 'Préparateurs de caisse')).toBe(4);
  });
});
