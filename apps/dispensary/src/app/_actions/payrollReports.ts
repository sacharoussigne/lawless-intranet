'use server';

import { fetchBusinessUserProfiles } from '@/lib/people/userProfiles';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/business/tenantWhere';
import { mergeResolvedDisplayNames } from '@/lib/businessWeeklyActivity/resolveDisplayName';
import {
  PAYROLL_CAISSE_SALE_USD,
  PAYROLL_CAISSE_USD,
  PAYROLL_OFFERED_ITEM_USD,
  PAYROLL_PATIENT_CARE_USD,
  PAYROLL_REPORT_TYPE_EMPLOYES,
  isPayrollReportType,
} from '@/lib/payroll/constants';
import { mergeHtmlAndWeeklyActivity, type WaRow } from '@/lib/payroll/mergeWeeklyActivity';
import { weeklyCounterDefinitions } from '@/lib/businessWeeklyActivity/counters';
import { attachDiscordProfilesToActivities } from '@/lib/businessDiscordProfile/attachProfiles';
import { type ParsedPayrollTable, parsePayrollHtmlTable } from '@/lib/payroll/parsePayrollHtmlTable';
import { payrollReportResultSchema } from '@/lib/payroll/schema';
import { weekRangeFromIsoDate } from '@/lib/payroll/week';
import { recalculatePayrollResult } from '@/lib/payroll/recalculatePayrollResult';
import type {
  SerializedPayrollReportDetail,
  SerializedPayrollReportListItem,
} from '@/lib/payroll/apiRow';
import { extractPayrollListSummary } from '@/lib/payroll/listSummary';
import { actionErrorParser } from '@/lib/action';
import { reportServerError } from '@/lib/logs/errorReporter';
import { withLoggedAction } from '@/lib/logs/writer';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { findBusinessProfiles } from '@/lib/businessDiscordProfile/queries';
import {
  toPayrollEmployeeRole,
  type PayrollEmployeeRole,
} from '@/lib/businessDiscordProfile/constants';

const MAX_CAISSE_PRICE_USD = 1_000_000;
const MAX_HTML_CHARS = 600_000;
const PAYROLL_LIST_LIMIT = 100;

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

const payrollViewGuardOptions = {
  feature: 'payroll' as const,
  permission: {
    resource: 'payroll_reports' as const,
    action: 'view',
    message: 'Accès refusé',
  },
};

const payrollCreateGuardOptions = {
  feature: 'payroll' as const,
  permission: {
    resource: 'payroll_reports' as const,
    action: 'create',
    message: 'Accès refusé',
  },
};

export async function listPayrollReports(businessSlug: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollViewGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const rows = await prisma.payrollWeeklyReport.findMany({
    where: tenantWhere(businessId),
    orderBy: [{ weekStart: 'desc' }, { reportType: 'asc' }],
    take: PAYROLL_LIST_LIMIT,
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      reportType: true,
      createdAt: true,
      createdById: true,
      resultJson: true,
    },
  });

  const creatorsById = await fetchBusinessUserProfiles(
    businessId,
    rows.map((row) => row.createdById),
  );

  const reports: SerializedPayrollReportListItem[] = rows.map((r) => ({
    id: r.id,
    weekStart: r.weekStart.toISOString(),
    weekEnd: r.weekEnd.toISOString(),
    reportType: r.reportType,
    createdAt: r.createdAt.toISOString(),
    createdBy: {
      id: r.createdById,
      name: creatorsById.get(r.createdById)?.name ?? 'Utilisateur',
    },
    summary: extractPayrollListSummary(r.resultJson),
  }));

  return { status: 200, data: { reports } };
}

export async function getPayrollReportById(businessSlug: string, id: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollViewGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const report = await prisma.payrollWeeklyReport.findFirst({
    where: { id, ...tenantWhere(businessId) },
  });

  if (!report) {
    return { status: 404, error: 'Not found' };
  }

  const creator = (
    await fetchBusinessUserProfiles(businessId, [report.createdById])
  ).get(report.createdById);

  const serialized: SerializedPayrollReportDetail = {
    id: report.id,
    weekStart: report.weekStart.toISOString(),
    weekEnd: report.weekEnd.toISOString(),
    reportType: report.reportType,
    resultJson: report.resultJson,
    errorMessage: report.errorMessage,
    createdAt: report.createdAt.toISOString(),
    createdBy: {
      name: creator?.name ?? 'Utilisateur',
      email: creator?.email ?? '',
    },
  };

  return { status: 200, data: { report: serialized } };
}

async function createPayrollReportFromFormUnlogged(businessSlug: string, formData: FormData) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollCreateGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const weekRef = formData.get('weekStart');
  const weekStartStr = typeof weekRef === 'string' ? weekRef : null;
  const htmlRaw = formData.get('tableHtml');
  const tableHtml = typeof htmlRaw === 'string' ? htmlRaw : '';
  const caisseRaw = formData.get('caissePriceUsd');
  let caissePriceUsd = PAYROLL_CAISSE_USD;
  if (caisseRaw != null && String(caisseRaw).trim() !== '') {
    const n = Number(String(caisseRaw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > MAX_CAISSE_PRICE_USD) {
      return {
        status: 400,
        error: 'Montant reversé employé invalide (entre 0,01 et 1 000 000 $).',
      };
    }
    caissePriceUsd = n;
  }

  const caisseSaleRaw = formData.get('caisseSalePriceUsd');
  let caisseSalePriceUsd = PAYROLL_CAISSE_SALE_USD;
  if (caisseSaleRaw != null && String(caisseSaleRaw).trim() !== '') {
    const n = Number(String(caisseSaleRaw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > MAX_CAISSE_PRICE_USD) {
      return {
        status: 400,
        error: 'Prix de vente dispensaire invalide (entre 0,01 et 1 000 000 $).',
      };
    }
    caisseSalePriceUsd = n;
  }

  const patientCareRaw = formData.get('patientCarePriceUsd');
  let patientCarePriceUsd = PAYROLL_PATIENT_CARE_USD;
  if (patientCareRaw != null && String(patientCareRaw).trim() !== '') {
    const n = Number(String(patientCareRaw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > MAX_CAISSE_PRICE_USD) {
      return { status: 400, error: 'Prix par patient soigné invalide (entre 0,01 et 1 000 000 $).' };
    }
    patientCarePriceUsd = n;
  }

  const offeredRaw = formData.get('offeredItemPriceUsd');
  let offeredItemPriceUsd = PAYROLL_OFFERED_ITEM_USD;
  if (offeredRaw != null && String(offeredRaw).trim() !== '') {
    const n = Number(String(offeredRaw).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > MAX_CAISSE_PRICE_USD) {
      return { status: 400, error: "Prix unitaire d'offre invalide (entre 0,01 et 1 000 000 $)." };
    }
    offeredItemPriceUsd = n;
  }

  const importWaRaw = formData.get('importWeeklyActivity');
  const importWeeklyActivity =
    importWaRaw === '1' || importWaRaw === 'on' || importWaRaw === 'true';

  const waWeekRef = formData.get('weeklyActivityWeekStart');
  const waWeekStartStr =
    importWeeklyActivity &&
    typeof waWeekRef === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(waWeekRef.trim())
      ? waWeekRef.trim()
      : null;

  if (!weekStartStr || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartStr)) {
    return { status: 400, error: 'weekStart must be YYYY-MM-DD' };
  }

  const reportTypeRaw = formData.get('reportType');
  const reportTypeStr =
    typeof reportTypeRaw === 'string' && reportTypeRaw.trim() !== ''
      ? reportTypeRaw.trim()
      : PAYROLL_REPORT_TYPE_EMPLOYES;
  if (!isPayrollReportType(reportTypeStr)) {
    return { status: 400, error: 'Type de rapport invalide.' };
  }
  const reportType = reportTypeStr;

  if (tableHtml.length > MAX_HTML_CHARS) {
    return { status: 400, error: `Le HTML est trop long (max ${MAX_HTML_CHARS} caractères)` };
  }

  const emptyParsed: ParsedPayrollTable = {
    employees: [],
    global_stats: { total_employees: 0, total_caisses: 0, total_sherifs: 0, total_palefreniers: 0 },
  };

  let parsed: ParsedPayrollTable;
  try {
    parsed = tableHtml.trim() ? parsePayrollHtmlTable(tableHtml) : emptyParsed;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Échec du parse HTML';
    return { status: 400, error: msg };
  }

  let activitiesWithNames: WaRow[] = [];
  let waImportStart: Date | undefined;
  let waImportEnd: Date | undefined;

  if (importWeeklyActivity) {
    const range = weekRangeFromIsoDate(waWeekStartStr ?? weekStartStr);
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
    parsed,
    activitiesWithNames,
    weeklyCounterDefinitions(ctx.tenant.business.type),
  );

  // No HTML and nothing imported: the report starts empty, people are added on its page.

  const { weekStart, weekEnd } = weekRangeFromIsoDate(weekStartStr);

  const existing = await prisma.payrollWeeklyReport.findUnique({
    where: {
      businessId_weekStart_reportType: {
        businessId,
        weekStart,
        reportType,
      },
    },
  });
  if (existing) {
    return { status: 409, error: 'Un rapport de ce type existe déjà pour cette semaine.' };
  }

  const reportId = randomUUID();

  try {
    const result = recalculatePayrollResult(
      payrollReportResultSchema.parse({
        employees: employeesMerged,
        global_stats: emptyGlobalStats(),
        caisse_price_usd: caissePriceUsd,
        caisse_sale_price_usd: caisseSalePriceUsd,
        patient_care_price_usd: patientCarePriceUsd,
        offered_item_price_usd: offeredItemPriceUsd,
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
        createdById: ctx.session.user.id,
        resultJson: result as object,
        errorMessage: null,
      },
    });

    return { status: 200, data: { id: reportId } };
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
        createdById: ctx.session.user.id,
        errorMessage: msg,
      },
    });
    return { status: 500, error: msg };
  }
}

async function updatePayrollReportResultJsonUnlogged(
  businessSlug: string,
  id: string,
  resultJson: unknown,
) {
  try {
    return await updatePayrollReportResultJsonInner(businessSlug, id, resultJson);
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la modification du rapport de paie');
  }
}

async function updatePayrollReportResultJsonInner(
  businessSlug: string,
  id: string,
  resultJson: unknown,
) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollCreateGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const existing = await prisma.payrollWeeklyReport.findFirst({
    where: { id, ...tenantWhere(businessId) },
    select: { id: true, errorMessage: true, resultJson: true },
  });

  if (!existing) {
    return { status: 404, error: 'Not found' };
  }

  if (existing.errorMessage != null) {
    return { status: 400, error: 'Cannot update a failed report' };
  }

  if (existing.resultJson == null) {
    return { status: 400, error: 'No result data to update' };
  }

  const parsedBody = payrollReportResultSchema.safeParse(resultJson);
  if (!parsedBody.success) {
    return { status: 400, error: 'Invalid resultJson' };
  }

  const recalculated = recalculatePayrollResult(parsedBody.data);

  await prisma.payrollWeeklyReport.update({
    where: { id: existing.id },
    data: { resultJson: recalculated as object },
  });

  return { status: 200, data: { resultJson: recalculated } };
}

async function deletePayrollReportUnlogged(businessSlug: string, id: string) {
  try {
    return await deletePayrollReportInner(businessSlug, id);
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du rapport de paie');
  }
}

async function deletePayrollReportInner(businessSlug: string, id: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollCreateGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const report = await prisma.payrollWeeklyReport.findFirst({
    where: { id, ...tenantWhere(businessId) },
    select: { id: true },
  });

  if (!report) {
    return { status: 404, error: 'Not found' };
  }

  await prisma.payrollWeeklyReport.delete({ where: { id: report.id } });

  return { status: 200 };
}

export async function listPayrollImportableActivityWeeks(businessSlug: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollCreateGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const groups = await prisma.businessWeeklyActivity.groupBy({
    by: ['periodStart', 'periodEnd'],
    where: tenantWhere(businessId),
    _count: { _all: true },
    orderBy: { periodStart: 'desc' },
    take: 52,
  });

  return {
    status: 200,
    data: {
      weeks: groups.map((g) => ({
        weekStart: g.periodStart.toISOString().slice(0, 10),
        periodStart: g.periodStart.toISOString(),
        periodEnd: g.periodEnd.toISOString(),
      })),
    },
  };
}

export type PayrollPerson = {
  discordUserId: string;
  name: string;
  /** Grade when it is a payroll role (PAYROLL_EMPLOYEE_ROLES), null otherwise. */
  role: PayrollEmployeeRole | null;
  accountNumber: number | null;
};

/** People of the business (Gestion › Personnes) offered when adding someone to a report. */
export async function listPayrollPeople(businessSlug: string) {
  const ctx = await requireTenantServerActionContext(businessSlug, payrollCreateGuardOptions);
  if (!ctx.ok) return ctx.response;
  const { businessId } = ctx.tenant;

  const profiles = await findBusinessProfiles(prisma, businessId);
  const accounts = await fetchBusinessUserProfiles(
    businessId,
    profiles.map((p) => p.userId).filter((id): id is string => Boolean(id)),
  );

  const people: PayrollPerson[] = profiles
    .map((p) => ({
      discordUserId: p.discordUserId,
      name: pickProfileDisplayName(
        p,
        (p.userId ? accounts.get(p.userId)?.name : undefined) ?? p.discordUserId,
      ),
      role: toPayrollEmployeeRole(p.role),
      accountNumber: p.accountNumber,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return { status: 200, data: { people } };
}

/*
 * Sensitive feature: every mutation is logged (success, refusal, failure), see docs/APP-LOGS.md.
 */

/** Form fields for the log: short values as they are, long ones (the pasted HTML) by size only. */
function summarizePayrollForm(formData: FormData): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') {
      summary[key] = { file: value.name, size: value.size };
    } else {
      summary[key] = value.length > 200 ? `[${value.length} caractères]` : value;
    }
  }
  return summary;
}

export async function createPayrollReportFromForm(businessSlug: string, formData: FormData) {
  return withLoggedAction(
    {
      feature: 'payroll',
      event: 'payroll.report.create',
      label: 'Création d’un rapport de paie',
      context: summarizePayrollForm(formData),
    },
    () => createPayrollReportFromFormUnlogged(businessSlug, formData),
    (result) => ('data' in result && result.data ? { context: result.data } : undefined),
  );
}

export async function updatePayrollReportResultJson(
  businessSlug: string,
  id: string,
  resultJson: unknown,
) {
  return withLoggedAction(
    {
      feature: 'payroll',
      event: 'payroll.report.update',
      label: 'Modification d’un rapport de paie',
      context: { id },
    },
    () => updatePayrollReportResultJsonUnlogged(businessSlug, id, resultJson),
  );
}

export async function deletePayrollReport(businessSlug: string, id: string) {
  return withLoggedAction(
    {
      feature: 'payroll',
      event: 'payroll.report.delete',
      label: 'Suppression d’un rapport de paie',
      context: { id },
    },
    () => deletePayrollReportUnlogged(businessSlug, id),
  );
}
