/** Grades recognized by payroll HTML parsing (parsePayrollHtmlTable). */
export const PAYROLL_EMPLOYEE_ROLES = [
  'Médecin',
  'Apprenti',
  'Apprentie',
  'Infirmière',
  'Infirmier',
  'Directeur',
  'Directrice',
  'Co-Directeur',
  'Co-Directrice',
  'Préparateur de caisses',
  'Préparatrice de caisses',
] as const;

export type PayrollEmployeeRole = (typeof PAYROLL_EMPLOYEE_ROLES)[number];

export function isPayrollEmployeeRole(value: string): value is PayrollEmployeeRole {
  return (PAYROLL_EMPLOYEE_ROLES as readonly string[]).includes(value);
}


/** A grade from a select (or stored text) as a payroll role; anything else is « no grade ». */
export function toPayrollEmployeeRole(value: string | null | undefined): PayrollEmployeeRole | null {
  const trimmed = value?.trim();
  return trimmed && isPayrollEmployeeRole(trimmed) ? trimmed : null;
}
