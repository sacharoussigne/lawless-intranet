import prisma from '@/lib/prisma';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import type { BusinessType, WeeklyCounterDefinition } from '@/lib/businessTypes';
import { loadDiscordProfilesByIds, type ProfileSalaryType } from '@/lib/businessDiscordProfile/queries';
import { weeklyCounterDefinitions, weeklyCounterValue, type WeeklyCounters } from '@/lib/businessWeeklyActivity/counters';
import { estimatePayoutUsd } from '@/lib/payroll/recalculatePayrollResult';
import { resolvePayrollDefaultRates, type PayrollDefaultRates } from '@/lib/payroll/salaryTypes';

/** Estimated pay of a weekly activity row, shown by the Discord bot. */
export type BotSalaryEstimate = {
  /** Salary type of the person, otherwise the default one (null: none configured). */
  typeLabel: string | null;
  caisseUnitUsd: number;
  patientCareUsd: number;
  caisses: number;
  patients: number;
  estimatedUsd: number;
};

type RowForEstimate = { discordUserId: string; chestTotal: number; counters: WeeklyCounters };

/** Caisses × caisse unit + patients (counters paid as `patients_soignes`, not the sheriff ones) × patient rate. */
export function estimateRowSalary(
  row: Pick<RowForEstimate, 'chestTotal' | 'counters'>,
  salaryType: ProfileSalaryType | null,
  defaults: PayrollDefaultRates,
  counterDefinitions: readonly WeeklyCounterDefinition[],
): BotSalaryEstimate {
  const caisseUnitUsd = salaryType?.caisseUnitUsd ?? defaults.caisseUnitUsd;
  const patients = counterDefinitions
    .filter((c) => c.payrollStat === 'patients_soignes')
    .reduce((sum, c) => sum + weeklyCounterValue(row.counters, c.key), 0);
  const caisses = row.chestTotal;
  return {
    typeLabel: salaryType?.label ?? defaults.defaultSalaryTypeLabel,
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
): Promise<(T & { salary: BotSalaryEstimate | null })[]> {
  const settings = await getAppSettings(businessId);
  if (rows.length === 0 || !isAppFeatureEnabled(settings, 'payroll')) {
    return rows.map((row) => ({ ...row, salary: null }));
  }

  const [defaults, profiles] = await Promise.all([
    resolvePayrollDefaultRates(businessId),
    loadDiscordProfilesByIds(prisma, businessId, rows.map((r) => r.discordUserId)),
  ]);
  const counterDefinitions = weeklyCounterDefinitions(businessType);
  return rows.map((row) => ({
    ...row,
    salary: estimateRowSalary(
      row,
      profiles.get(row.discordUserId)?.salaryType ?? null,
      defaults,
      counterDefinitions,
    ),
  }));
}
