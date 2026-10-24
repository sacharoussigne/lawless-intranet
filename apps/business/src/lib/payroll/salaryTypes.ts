import prisma from '@/lib/prisma';
import { getAppSettings } from '@/lib/appSettings';
import { PAYROLL_CAISSE_USD } from '@/lib/payroll/constants';

/** Salary type of a business (Réglages › Salaires). */
export type PayrollSalaryTypeDTO = {
  id: string;
  label: string;
  caisseUnitUsd: number;
  isDefault: boolean;
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
      _count: { select: { people: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    caisseUnitUsd: Number(row.caisseUnitUsd),
    isDefault: row.isDefault,
    peopleCount: row._count.people,
  }));
}

export type PayrollDefaultRates = {
  /** Caisse unit of the default salary type, otherwise `PAYROLL_CAISSE_USD`. */
  caisseUnitUsd: number;
  patientCareUsd: number;
  defaultSalaryTypeLabel: string | null;
};

/** Rates used for people without a salary type, and as the prices of a new report. */
export async function resolvePayrollDefaultRates(businessId: string): Promise<PayrollDefaultRates> {
  const [defaultType, settings] = await Promise.all([
    prisma.payrollSalaryType.findFirst({
      where: { businessId, isDefault: true },
      select: { label: true, caisseUnitUsd: true },
    }),
    getAppSettings(businessId),
  ]);
  return {
    caisseUnitUsd: defaultType ? Number(defaultType.caisseUnitUsd) : PAYROLL_CAISSE_USD,
    patientCareUsd: settings.payrollPatientCareUsd,
    defaultSalaryTypeLabel: defaultType?.label ?? null,
  };
}
