import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findActivities: vi.fn(),
  findReport: vi.fn(),
  createReport: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    businessWeeklyActivity: { findMany: mocks.findActivities },
    payrollWeeklyReport: { findUnique: mocks.findReport, create: mocks.createReport },
  },
}));
vi.mock('@/lib/businessWeeklyActivity/resolveDisplayName', () => ({
  mergeResolvedDisplayNames: async (_db: unknown, _id: string, rows: unknown[]) => rows,
}));
vi.mock('@/lib/businessDiscordProfile/attachProfiles', () => ({
  attachDiscordProfilesToActivities: async (_db: unknown, rows: unknown[]) => rows,
}));
vi.mock('@/lib/logs/errorReporter', () => ({ reportServerError: vi.fn() }));

const { createPayrollReport, EMPTY_PARSED_PAYROLL_TABLE, PAYROLL_REPORT_EXISTS_MESSAGE } = await import(
  '@/lib/payroll/createReport'
);
const { weekRangeFromIsoDate } = await import('@/lib/payroll/week');

const input = {
  businessId: 'b1',
  businessType: 'DISPENSARY' as const,
  // A Wednesday: the report covers Monday 19 → Sunday 25 October.
  weekStartStr: '2026-10-21',
  reportType: 'Employés' as const,
  parsed: EMPTY_PARSED_PAYROLL_TABLE,
  importWeeklyActivity: true,
  prices: { caissePriceUsd: 6.5, caisseSalePriceUsd: 7.5, patientCarePriceUsd: 0.3, offeredItemPriceUsd: 0.4 },
  createdById: 'discord:284726189304512512',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findActivities.mockResolvedValue([]);
  mocks.findReport.mockResolvedValue(null);
  mocks.createReport.mockResolvedValue({});
});

describe('createPayrollReport', () => {
  it('imports the activity of the week of the given day and creates the report', async () => {
    const result = await createPayrollReport(input);
    const monday = weekRangeFromIsoDate('2026-10-19');

    expect(result.status).toBe(200);
    expect(mocks.findActivities).toHaveBeenCalledWith({
      where: expect.objectContaining({ periodStart: monday.weekStart, periodEnd: monday.weekEnd }),
    });
    const data = mocks.createReport.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({
      businessId: 'b1',
      reportType: 'Employés',
      weekStart: monday.weekStart,
      createdById: 'discord:284726189304512512',
      errorMessage: null,
    });
    expect(data.resultJson.weekly_activity_import.weekStart).toBe(monday.weekStart.toISOString());
  });

  it('returns the existing report of the week instead of creating a second one', async () => {
    mocks.findReport.mockResolvedValue({ id: 'existing' });
    const result = await createPayrollReport(input);

    expect(result).toMatchObject({ status: 409, error: PAYROLL_REPORT_EXISTS_MESSAGE, existingId: 'existing' });
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it('does not read the activity when the import is off', async () => {
    await createPayrollReport({ ...input, importWeeklyActivity: false });
    expect(mocks.findActivities).not.toHaveBeenCalled();
    expect(mocks.createReport.mock.calls[0]?.[0]?.data.resultJson.weekly_activity_import).toBeUndefined();
  });
});
