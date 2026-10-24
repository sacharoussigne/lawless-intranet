import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAppSettings: vi.fn(),
  isAppFeatureEnabled: vi.fn(),
  resolveRates: vi.fn(),
  loadProfiles: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/appSettings', () => ({
  getAppSettings: mocks.getAppSettings,
  isAppFeatureEnabled: mocks.isAppFeatureEnabled,
}));
vi.mock('@/lib/payroll/salaryTypes', () => ({ resolvePayrollDefaultRates: mocks.resolveRates }));
vi.mock('@/lib/businessDiscordProfile/queries', () => ({ loadDiscordProfilesByIds: mocks.loadProfiles }));

const { attachBotSalaryEstimates, estimateRowSalary } = await import('@/lib/payroll/botSalaryEstimate');
const { businessTypes } = await import('@/lib/businessTypes');

const DISPENSARY_COUNTERS = businessTypes.DISPENSARY.weeklyCounters;
const defaults = { caisseUnitUsd: 6.5, patientCareUsd: 0.3, defaultSalaryTypeLabel: 'Employé' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppSettings.mockResolvedValue({});
  mocks.isAppFeatureEnabled.mockReturnValue(true);
  mocks.resolveRates.mockResolvedValue(defaults);
});

describe('estimateRowSalary', () => {
  it('pays caisses and patients, not the sheriff care', () => {
    const estimate = estimateRowSalary(
      { chestTotal: 4, counters: { patients: 21, sheriffs: 10, infusions: 3 } },
      null,
      defaults,
      DISPENSARY_COUNTERS,
    );
    expect(estimate).toMatchObject({ typeLabel: 'Employé', caisses: 4, patients: 21, caisseUnitUsd: 6.5 });
    expect(estimate.estimatedUsd).toBeCloseTo(4 * 6.5 + 21 * 0.3);
  });

  it('uses the salary type of the person', () => {
    const estimate = estimateRowSalary(
      { chestTotal: 2, counters: {} },
      { id: 's2', label: 'Préparateur de caisse', caisseUnitUsd: 5 },
      defaults,
      DISPENSARY_COUNTERS,
    );
    expect(estimate).toMatchObject({ typeLabel: 'Préparateur de caisse', caisseUnitUsd: 5, estimatedUsd: 10 });
  });
});

describe('attachBotSalaryEstimates', () => {
  const rows = [
    { discordUserId: '1', chestTotal: 3, counters: { patients: 10 } },
    { discordUserId: '2', chestTotal: 1, counters: { patients: 0 } },
  ];

  it('gives null salaries without the payroll module', async () => {
    mocks.isAppFeatureEnabled.mockReturnValue(false);

    const out = await attachBotSalaryEstimates('b1', 'DISPENSARY', rows);
    expect(out.map((r) => r.salary)).toEqual([null, null]);
    expect(mocks.loadProfiles).not.toHaveBeenCalled();
  });

  it('estimates each row with the salary type of its person', async () => {
    mocks.loadProfiles.mockResolvedValue(
      new Map([['2', { salaryType: { id: 's2', label: 'Préparateur de caisse', caisseUnitUsd: 5 } }]]),
    );

    const out = await attachBotSalaryEstimates('b1', 'DISPENSARY', rows);
    expect(out[0].salary?.estimatedUsd).toBeCloseTo(3 * 6.5 + 10 * 0.3);
    expect(out[1].salary).toMatchObject({ typeLabel: 'Préparateur de caisse', estimatedUsd: 5 });
  });
});
