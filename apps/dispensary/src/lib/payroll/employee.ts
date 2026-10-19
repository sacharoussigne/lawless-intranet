import type { PayrollReportResult } from '@/lib/payroll/schema';
import { PAYROLL_DAYS } from '@/lib/payroll/parsePayrollHtmlTable';

type PayrollEmployee = PayrollReportResult['employees'][number];

/** Employee added by hand to a report: empty schedule and stats, filled on the report page. */
export function createPayrollEmployee(identity: {
  name: string;
  role: string;
  /** RP bank account number (virements), null when unknown. */
  id: number | null;
}): PayrollEmployee {
  const schedule = Object.fromEntries(
    PAYROLL_DAYS.map((day) => [day, { caisse: null, presence: null }]),
  ) as PayrollEmployee['schedule'];
  return {
    name: identity.name.trim(),
    role: identity.role.trim(),
    id: identity.id,
    schedule,
    stats: {
      sherifs: null,
      palefreniers: null,
      nombre_caisses: 0,
      nombre_presences: 0,
      patients_soignes: 0,
      poppy_milk_offertes: 0,
      infusions_ginseng_offertes: 0,
    },
    salary_supplement_usd: 0,
  };
}
