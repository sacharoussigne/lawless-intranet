import { describe, expect, it } from 'vitest';
import {
  PAYROLL_CAISSE_SALE_USD,
  PAYROLL_CAISSE_USD,
  PAYROLL_OFFERED_ITEM_USD,
  PAYROLL_PATIENT_CARE_USD,
} from './constants';
import { createPayrollEmployee } from './employee';
import { recalculatePayrollResult } from './recalculatePayrollResult';
import { payrollReportResultSchema, type PayrollReportResult } from './schema';

function emptyReport(): PayrollReportResult {
  return payrollReportResultSchema.parse({
    caisse_price_usd: PAYROLL_CAISSE_USD,
    caisse_sale_price_usd: PAYROLL_CAISSE_SALE_USD,
    patient_care_price_usd: PAYROLL_PATIENT_CARE_USD,
    offered_item_price_usd: PAYROLL_OFFERED_ITEM_USD,
    weekly_activity_import: null,
    employees: [],
    global_stats: {
      total_employees: 0,
      total_caisses: 0,
      total_sherifs: 0,
    },
  });
}

describe('empty payroll report', () => {
  it('is valid and totals 0', () => {
    const report = recalculatePayrollResult(emptyReport());
    expect(report.employees).toEqual([]);
    expect(report.global_stats).toMatchObject({
      total_employees: 0,
      total_caisses: 0,
      total_employee_payout_usd: 0,
      total_benefit_usd: 0,
    });
  });
});

describe('createPayrollEmployee', () => {
  it('builds a valid employee with an empty schedule', () => {
    const employee = createPayrollEmployee({ name: '  Jack Reffle ', role: 'Médecin', id: null });
    expect(employee.name).toBe('Jack Reffle');
    expect(employee.id).toBeNull();
    expect(Object.values(employee.schedule).every((d) => d.caisse === null && d.presence === null)).toBe(
      true,
    );
    expect(() =>
      payrollReportResultSchema.parse({ ...emptyReport(), employees: [employee] }),
    ).not.toThrow();
  });

  it('is paid once its days and patients are filled', () => {
    const employee = createPayrollEmployee({ name: 'Jack', role: 'Médecin', id: 42 });
    employee.schedule.lundi = { caisse: 'X', presence: 'P' };
    employee.schedule.mardi = { caisse: 'X', presence: null };
    employee.stats.patients_soignes = 3;

    const report = recalculatePayrollResult({ ...emptyReport(), employees: [employee] });
    expect(report.employees[0]?.stats.nombre_caisses).toBe(2);
    expect(report.employees[0]?.stats.nombre_presences).toBe(1);
    expect(report.global_stats.total_employees).toBe(1);
    expect(report.global_stats.total_employee_payout_usd).toBeCloseTo(
      2 * PAYROLL_CAISSE_USD + 3 * PAYROLL_PATIENT_CARE_USD,
    );
  });
});
