import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { type BusinessType } from '@/lib/businessTypes';
import { mergeResolvedDisplayNames } from '@/lib/businessWeeklyActivity/resolveDisplayName';
import { weeklyCounterDefinitions } from '@/lib/businessWeeklyActivity/counters';
import { attachDiscordProfilesToActivities } from '@/lib/businessDiscordProfile/attachProfiles';
import { reportServerError } from '@/lib/logs/errorReporter';
import { type PayrollReportType } from '@/lib/payroll/constants';
import { mergeHtmlAndWeeklyActivity, type WaRow } from '@/lib/payroll/mergeWeeklyActivity';
import { type ParsedPayrollTable } from '@/lib/payroll/parsePayrollHtmlTable';
import { recalculatePayrollResult } from '@/lib/payroll/recalculatePayrollResult';
import { payrollReportResultSchema } from '@/lib/payroll/schema';
import { weekRangeFromIsoDate } from '@/lib/payroll/week';

export const EMPTY_PARSED_PAYROLL_TABLE: ParsedPayrollTable = {
  employees: [],
  global_stats: { total_employees: 0, total_caisses: 0, total_sherifs: 0, total_palefreniers: 0 },
};

export const PAYROLL_REPORT_EXISTS_MESSAGE = 'Un rapport de ce type existe déjà pour cette semaine.';

const emptyGlobalStats = () => ({
  total_employees: 0,
  total_caisses: 0,
  total_sherifs: 0,
  total_palefreniers: 0,
  total_benefit_usd: 0,
  total_patients_soignes: 0,
  total_offered_item_count: 0,
  total_employee_payout_usd: 0,
  total_offered_retail_value_usd: 0,
});

export type PayrollReportPrices = {
  caissePriceUsd: number;
  caisseSalePriceUsd: number;
  patientCarePriceUsd: number;
  offeredItemPriceUsd: number;
};

export type CreatePayrollReportInput = {
  businessId: string;
  businessType: BusinessType;
  /** Any day of the report's week, `YYYY-MM-DD` (Paris). */
  weekStartStr: string;
  reportType: PayrollReportType;
  parsed: ParsedPayrollTable;
  importWeeklyActivity: boolean;
  /** Week to import the activity from, `YYYY-MM-DD` (Paris); defaults to the report's week. */
  waWeekStartStr?: string | null;
  prices: PayrollReportPrices;
  /** Author: an account id, or `discord:<id>` when the bot user has no account. */
  createdById: string;
};

export type CreatePayrollReportResult =
  | { status: 200; data: { id: string; weekStart: Date; weekEnd: Date } }
  | { status: 409; error: string; existingId: string; weekStart: Date; weekEnd: Date }
  | { status: 500; error: string };

/**
 * Creates a weekly payroll report, optionally filled from the weekly activity.
 * Shared by the intranet form (server action) and the Discord bot route; the caller checks access.
 */
export async function createPayrollReport(input: CreatePayrollReportInput): Promise<CreatePayrollReportResult> {
  const { businessId, reportType, importWeeklyActivity, prices, createdById } = input;

  let activitiesWithNames: WaRow[] = [];
  let waImportStart: Date | undefined;
  let waImportEnd: Date | undefined;

  if (importWeeklyActivity) {
    const range = weekRangeFromIsoDate(input.waWeekStartStr ?? input.weekStartStr);
    waImportStart = range.weekStart;
    waImportEnd = range.weekEnd;
    const rawActivities = await prisma.businessWeeklyActivity.findMany({
      where: {
        periodStart: waImportStart,
        periodEnd: waImportEnd,
        ...tenantWhere(businessId),
      },
    });
    activitiesWithNames = (await attachDiscordProfilesToActivities(
      prisma,
      (await mergeResolvedDisplayNames(prisma, businessId, rawActivities)) as WaRow[],
    )) as WaRow[];
  }

  const employeesMerged = mergeHtmlAndWeeklyActivity(
    input.parsed,
    activitiesWithNames,
    weeklyCounterDefinitions(input.businessType),
  );

  // No HTML and nothing imported: the report starts empty, people are added on its page.

  const { weekStart, weekEnd } = weekRangeFromIsoDate(input.weekStartStr);

  const existing = await prisma.payrollWeeklyReport.findUnique({
    where: {
      businessId_weekStart_reportType: {
        businessId,
        weekStart,
        reportType,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { status: 409, error: PAYROLL_REPORT_EXISTS_MESSAGE, existingId: existing.id, weekStart, weekEnd };
  }

  const reportId = randomUUID();

  try {
    const result = recalculatePayrollResult(
      payrollReportResultSchema.parse({
        employees: employeesMerged,
        global_stats: emptyGlobalStats(),
        caisse_price_usd: prices.caissePriceUsd,
        caisse_sale_price_usd: prices.caisseSalePriceUsd,
        patient_care_price_usd: prices.patientCarePriceUsd,
        offered_item_price_usd: prices.offeredItemPriceUsd,
        ...(importWeeklyActivity && waImportStart && waImportEnd
          ? {
              weekly_activity_import: {
                weekStart: waImportStart.toISOString(),
                weekEnd: waImportEnd.toISOString(),
              },
            }
          : {}),
      }),
    );

    await prisma.payrollWeeklyReport.create({
      data: {
        id: reportId,
        businessId,
        weekStart,
        weekEnd,
        reportType,
        createdById,
        resultJson: result as object,
        errorMessage: null,
      },
    });

    return { status: 200, data: { id: reportId, weekStart, weekEnd } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    reportServerError({ error: e, status: 500, message: msg, feature: 'payroll', businessId });
    await prisma.payrollWeeklyReport.create({
      data: {
        id: reportId,
        businessId,
        weekStart,
        weekEnd,
        reportType,
        createdById,
        errorMessage: msg,
      },
    });
    return { status: 500, error: msg };
  }
}
