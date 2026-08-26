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
] as const;

export type PayrollEmployeeRole = (typeof PAYROLL_EMPLOYEE_ROLES)[number];
