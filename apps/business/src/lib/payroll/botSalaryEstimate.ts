import prisma from '@/lib/prisma';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import { DEFAULT_BUSINESS_TYPE, isCashPreparerGrade, type BusinessType, type WeeklyCounterDefinition } from '@/lib/businessTypes';
import { loadDiscordProfilesByIds, type ProfileSalaryType } from '@/lib/businessDiscordProfile/queries';
import { weeklyCounterDefinitions, weeklyCounterValue, type WeeklyCounters } from '@/lib/businessWeeklyActivity/counters';
import { estimatePayoutUsd } from '@/lib/payroll/recalculatePayrollResult';
import { resolvePayrollDefaultRates, type PayrollDefaultRates } from '@/lib/payroll/salaryTypes';
import { findOwnWeeklyActivityRow } from '@/lib/businessWeeklyActivity/findOwnRow';

/** Estimated pay of a weekly activity row, shown by the Discord bot and on the home page. */
export type SalaryEstimate = {
  /** Salary type of the person, otherwise the default one (null: none configured). */
  typeLabel: string | null;
  caisseUnitUsd: number;
  patientCareUsd: number;
  caisses: number;
  patients: number;
  estimatedUsd: number;
};

type RowForEstimate = { discordUserId: string; chestTotal: number; counters: WeeklyCounters };

/**
 * Caisses × caisse unit + patients (counters paid as `patients_soignes`, not the sheriff ones) × patient rate.
 * Without a salary type, a préparateur de caisses (by `grade`) gets the préparateurs' default.
 */
export function estimateRowSalary(
  row: Pick<RowForEstimate, 'chestTotal' | 'counters'>,
  salaryType: ProfileSalaryType | null,
  defaults: PayrollDefaultRates,
  counterDefinitions: readonly WeeklyCounterDefinition[],
  grade: string | null = null,
  businessType: BusinessType = DEFAULT_BUSINESS_TYPE,
): SalaryEstimate {
  const preparer = isCashPreparerGrade(businessType, grade);
  const caisseUnitUsd =
    salaryType?.caisseUnitUsd ??
    (preparer ? defaults.cashPreparerCaisseUnitUsd : defaults.caisseUnitUsd);
  const patients = counterDefinitions
    .filter((c) => c.payrollStat === 'patients_soignes')
    .reduce((sum, c) => sum + weeklyCounterValue(row.counters, c.key), 0);
  const caisses = row.chestTotal;
  return {
    typeLabel:
      salaryType?.label ??
      (preparer ? defaults.cashPreparerSalaryTypeLabel : defaults.defaultSalaryTypeLabel),
    caisseUnitUsd,
    patientCareUsd: defaults.patientCareUsd,
    caisses,
    patients,
    estimatedUsd: estimatePayoutUsd({
      caisses,
      caisseUnitUsd,
      patients,
      patientCareUsd: defaults.patientCareUsd,
    }),
  };
}

/** Adds `salary` to bot rows; null for each row when the payroll module is off. */
export async function attachBotSalaryEstimates<T extends RowForEstimate>(
  businessId: string,
  businessType: BusinessType,
  rows: T[],
): Promise<(T & { salary: SalaryEstimate | null })[]> {
  const settings = await getAppSettings(businessId);
  if (rows.length === 0 || !isAppFeatureEnabled(settings, 'payroll')) {
    return rows.map((row) => ({ ...row, salary: null }));
  }

  const [defaults, profiles] = await Promise.all([
    resolvePayrollDefaultRates(businessId),
    loadDiscordProfilesByIds(prisma, businessId, rows.map((r) => r.discordUserId)),
  ]);
  const counterDefinitions = weeklyCounterDefinitions(businessType);
  return rows.map((row) => {
    const profile = profiles.get(row.discordUserId);
    return {
      ...row,
      salary: estimateRowSalary(
        row,
        profile?.salaryType ?? null,
        defaults,
        counterDefinitions,
        profile?.role ?? null,
        businessType,
      ),
    };
  });
}

/**
 * Home page: the viewer's own row only, or every row with `all` (team list, the
 * Direction), so an employee never receives the others' pay.
 */
export async function attachViewerSalaryEstimates<T extends RowForEstimate & { userId: string | null }>(
  businessId: string,
  businessType: BusinessType,
  rows: T[],
  viewer: { sessionUserId: string; discordUserId: string | null; all: boolean },
): Promise<(T & { salary: SalaryEstimate | null })[]> {
  if (viewer.all) return attachBotSalaryEstimates(businessId, businessType, rows);
  const own = findOwnWeeklyActivityRow(rows, viewer.sessionUserId, viewer.discordUserId);
  const [ownWithSalary] = own ? await attachBotSalaryEstimates(businessId, businessType, [own]) : [];
  return rows.map((row) => (row === own && ownWithSalary ? ownWithSalary : { ...row, salary: null }));
}
