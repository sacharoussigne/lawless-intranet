import prisma from '@/lib/prisma';
import { getAppSettings } from '@/lib/appSettings';
import {
  PAYROLL_CAISSE_USD,
  PAYROLL_REPORT_TYPE_PREPARATEURS_CAISSE,
  type PayrollReportType,
} from '@/lib/payroll/constants';

/** Salary type of a business (Réglages › Salaires). */
export type PayrollSalaryTypeDTO = {
  id: string;
  label: string;
  caisseUnitUsd: number;
  isDefault: boolean;
  /** Default of the « Préparateurs de caisse » report. */
  isCashPreparerDefault: boolean;
  /** People of the business with this salary type. */
  peopleCount: number;
};

export async function listPayrollSalaryTypes(businessId: string): Promise<PayrollSalaryTypeDTO[]> {
  const rows = await prisma.payrollSalaryType.findMany({
    where: { businessId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      label: true,
      caisseUnitUsd: true,
      isDefault: true,
      isCashPreparerDefault: true,
      _count: { select: { people: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    caisseUnitUsd: Number(row.caisseUnitUsd),
    isDefault: row.isDefault,
    isCashPreparerDefault: row.isCashPreparerDefault,
    peopleCount: row._count.people,
  }));
}

export type PayrollDefaultRates = {
  /** Caisse unit of the default salary type, otherwise `PAYROLL_CAISSE_USD`. */
  caisseUnitUsd: number;
  patientCareUsd: number;
  defaultSalaryTypeLabel: string | null;
  /** Préparateurs de caisse without a salary type: their default type, otherwise the one above. */
  cashPreparerCaisseUnitUsd: number;
  cashPreparerSalaryTypeLabel: string | null;
};

/** Rates used for people without a salary type, and as the prices of a new report. */
export async function resolvePayrollDefaultRates(businessId: string): Promise<PayrollDefaultRates> {
  const [defaultType, preparerType, settings] = await Promise.all([
    prisma.payrollSalaryType.findFirst({
      where: { businessId, isDefault: true },
      select: { label: true, caisseUnitUsd: true },
    }),
    prisma.payrollSalaryType.findFirst({
      where: { businessId, isCashPreparerDefault: true },
      select: { label: true, caisseUnitUsd: true },
    }),
    getAppSettings(businessId),
  ]);
  const caisseUnitUsd = defaultType ? Number(defaultType.caisseUnitUsd) : PAYROLL_CAISSE_USD;
  const defaultSalaryTypeLabel = defaultType?.label ?? null;
  return {
    caisseUnitUsd,
    patientCareUsd: settings.payrollPatientCareUsd,
    defaultSalaryTypeLabel,
    cashPreparerCaisseUnitUsd: preparerType ? Number(preparerType.caisseUnitUsd) : caisseUnitUsd,
    cashPreparerSalaryTypeLabel: preparerType?.label ?? defaultSalaryTypeLabel,
  };
}

/** Caisse price of a new report in « Salaire par défaut » mode: the default type of its kind of report. */
export function defaultCaisseUnitForReport(
  rates: Pick<PayrollDefaultRates, 'caisseUnitUsd' | 'cashPreparerCaisseUnitUsd'>,
  reportType: PayrollReportType,
): number {
  return reportType === PAYROLL_REPORT_TYPE_PREPARATEURS_CAISSE
    ? rates.cashPreparerCaisseUnitUsd
    : rates.caisseUnitUsd;
}
