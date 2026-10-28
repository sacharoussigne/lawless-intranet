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

const { attachBotSalaryEstimates, attachViewerSalaryEstimates, estimateRowSalary } = await import('@/lib/payroll/botSalaryEstimate');
const { businessTypes } = await import('@/lib/businessTypes');

const DISPENSARY_COUNTERS = businessTypes.DISPENSARY.weeklyCounters;
const defaults = {
  caisseUnitUsd: 6.5,
  patientCareUsd: 0.3,
  defaultSalaryTypeLabel: 'Employé',
  cashPreparerCaisseUnitUsd: 4,
  cashPreparerSalaryTypeLabel: 'Préparateur',
};

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

  it('gives a préparateur de caisses without salary type the préparateurs default', () => {
    const estimate = estimateRowSalary(
      { chestTotal: 3, counters: {} },
      null,
      defaults,
      DISPENSARY_COUNTERS,
      'Préparatrice de caisses',
    );
    expect(estimate).toMatchObject({ typeLabel: 'Préparateur', caisseUnitUsd: 4, estimatedUsd: 12 });
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

describe('attachViewerSalaryEstimates', () => {
  const rows = [
    { discordUserId: '1', userId: 'u1', chestTotal: 3, counters: { patients: 10 } },
    { discordUserId: '2', userId: 'u2', chestTotal: 2, counters: { patients: 0 } },
  ];

  beforeEach(() => mocks.loadProfiles.mockResolvedValue(new Map()));

  it('estimates the viewer row only, found by Discord ID', async () => {
    const out = await attachViewerSalaryEstimates('b1', 'DISPENSARY', rows, { sessionUserId: 'someone-else', discordUserId: '2', all: false });
    expect(out[0].salary).toBeNull();
    expect(out[1].salary?.estimatedUsd).toBeCloseTo(2 * 6.5);
    expect(mocks.loadProfiles).toHaveBeenCalledWith({}, 'b1', ['2']);
  });

  it('falls back on the account when the viewer has no Discord ID', async () => {
    const out = await attachViewerSalaryEstimates('b1', 'DISPENSARY', rows, { sessionUserId: 'u1', discordUserId: null, all: false });
    expect(out.map((r) => r.salary != null)).toEqual([true, false]);
  });

  it('gives no salary when the viewer has no row', async () => {
    const out = await attachViewerSalaryEstimates('b1', 'DISPENSARY', rows, { sessionUserId: 'u9', discordUserId: '9', all: false });
    expect(out.map((r) => r.salary)).toEqual([null, null]);
    expect(mocks.loadProfiles).not.toHaveBeenCalled();
  });

  it('estimates every row for the team list', async () => {
    const out = await attachViewerSalaryEstimates('b1', 'DISPENSARY', rows, {
      sessionUserId: 'u9',
      discordUserId: '9',
      all: true,
    });
    expect(out.map((r) => r.salary?.estimatedUsd)).toEqual([3 * 6.5 + 10 * 0.3, 2 * 6.5]);
    expect(mocks.loadProfiles).toHaveBeenCalledWith({}, 'b1', ['1', '2']);
  });
});
