import type { PayrollReportResult } from '@/lib/payroll/schema';
import { payrollNameKey, type WaRow } from '@/lib/payroll/mergeWeeklyActivity';
import type { StaffMemberOfPeriod } from '@/lib/staff/service';
import { isCashPreparerGrade, type BusinessType } from '@/lib/businessTypes';
import { PAYROLL_REPORT_TYPE_PREPARATEURS_CAISSE, type PayrollReportType } from '@/lib/payroll/constants';

type PayrollEmployee = PayrollReportResult['employees'][number];

/** Activity rows of employed people take the grade they held that week (staff register). */
export function withStaffRoles<T extends WaRow>(activities: T[], staff: StaffMemberOfPeriod[]): T[] {
  const roleById = new Map(staff.map((member) => [member.discordUserId, member.role]));
  return activities.map((row) => {
    const role = roleById.get(row.discordUserId);
    return role ? { ...row, discordProfileRole: role } : row;
  });
}

function emptyEmployee(member: StaffMemberOfPeriod): PayrollEmployee {
  const day = () => ({ caisse: null, presence: null });
  return {
    name: member.displayName,
    role: member.role ?? '',
    id: member.accountNumber,
    ...(member.caisseUnitUsd != null ? { caisse_unit_override_usd: member.caisseUnitUsd } : {}),
    salary_supplement_usd: 0,
    schedule: {
      lundi: day(),
      mardi: day(),
      mercredi: day(),
      jeudi: day(),
      vendredi: day(),
      samedi: day(),
      dimanche: day(),
    },
    stats: {
      sherifs: null,
      palefreniers: null,
      nombre_caisses: 0,
      nombre_presences: 0,
      patients_soignes: 0,
      poppy_milk_offertes: 0,
      infusions_ginseng_offertes: 0,
    },
  };
}

/**
 * Employed people without any activity that week still get a line (all zero),
 * so the report and the city hall letter list the whole staff.
 */
export function appendIdleStaff(
  employees: PayrollEmployee[],
  activities: Pick<WaRow, 'discordUserId'>[],
  staff: StaffMemberOfPeriod[],
): PayrollEmployee[] {
  const withActivity = new Set(activities.map((row) => row.discordUserId));
  const names = new Set(employees.map((employee) => payrollNameKey(employee.name)));
  const idle = staff.filter(
    (member) => !withActivity.has(member.discordUserId) && !names.has(payrollNameKey(member.displayName)),
  );
  return [...employees, ...idle.map(emptyEmployee)];
}

/**
 * Who a report pays, by the grade held that week (after withStaffRoles): the
 * « Préparateurs de caisse » report only the préparateurs de caisses, the
 * « Employés » report everyone else.
 */
export function staffForReportType<T extends Pick<WaRow, 'discordProfileRole'>>(
  businessType: BusinessType,
  reportType: PayrollReportType,
  activities: T[],
  staff: StaffMemberOfPeriod[],
): { activities: T[]; staff: StaffMemberOfPeriod[] } {
  const wantsPreparers = reportType === PAYROLL_REPORT_TYPE_PREPARATEURS_CAISSE;
  return {
    activities: activities.filter((row) => isCashPreparerGrade(businessType, row.discordProfileRole) === wantsPreparers),
    staff: staff.filter((member) => isCashPreparerGrade(businessType, member.role) === wantsPreparers),
  };
}
