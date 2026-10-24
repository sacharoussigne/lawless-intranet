import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findDefault: vi.fn(),
  getAppSettings: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: { payrollSalaryType: { findFirst: mocks.findDefault } },
}));
vi.mock('@/lib/appSettings', () => ({ getAppSettings: mocks.getAppSettings }));

const { resolvePayrollDefaultRates } = await import('@/lib/payroll/salaryTypes');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppSettings.mockResolvedValue({ payrollPatientCareUsd: 0.25 });
});

describe('resolvePayrollDefaultRates', () => {
  it('uses the default salary type and the patient rate of the business', async () => {
    // Prisma returns a Decimal for the caisse unit.
    mocks.findDefault.mockResolvedValue({ label: 'Employé', caisseUnitUsd: { toString: () => '7', valueOf: () => 7 } });

    await expect(resolvePayrollDefaultRates('b1')).resolves.toEqual({
      caisseUnitUsd: 7,
      patientCareUsd: 0.25,
      defaultSalaryTypeLabel: 'Employé',
    });
    expect(mocks.findDefault).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'b1', isDefault: true } }),
    );
  });

  it('falls back to 6.5 $ per caisse without a default salary type', async () => {
    mocks.findDefault.mockResolvedValue(null);

    await expect(resolvePayrollDefaultRates('b1')).resolves.toEqual({
      caisseUnitUsd: 6.5,
      patientCareUsd: 0.25,
      defaultSalaryTypeLabel: null,
    });
  });
});
