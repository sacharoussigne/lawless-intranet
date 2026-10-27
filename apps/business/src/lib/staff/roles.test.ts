import { describe, expect, it } from 'vitest';
import { effectiveMemberRoles } from './roles';

const base = { type: 'DISPENSARY' as const };

describe('effectiveMemberRoles', () => {
  it('gives the roles of the grade while employed', () => {
    expect(effectiveMemberRoles({ ...base, employed: true, grade: 'Médecin', manualRoles: '' })).toBe('employee');
    expect(effectiveMemberRoles({ ...base, employed: true, grade: 'Directeur', manualRoles: '' })).toBe(
      'direction,employee',
    );
    expect(effectiveMemberRoles({ ...base, employed: true, grade: 'Préparatrice de caisses', manualRoles: '' })).toBe(
      'cash_preparer',
    );
  });

  it('treats an employee without a grade as an employee', () => {
    expect(effectiveMemberRoles({ ...base, employed: true, grade: null, manualRoles: '' })).toBe('employee');
  });

  it('adds the manual roles without duplicates', () => {
    expect(
      effectiveMemberRoles({ ...base, employed: true, grade: 'Médecin', manualRoles: 'inventory_manager,employee' }),
    ).toBe('employee,inventory_manager');
  });

  it('keeps only the manual roles after leaving', () => {
    expect(effectiveMemberRoles({ ...base, employed: false, grade: 'Directeur', manualRoles: 'admin' })).toBe('admin');
    expect(effectiveMemberRoles({ ...base, employed: false, grade: 'Directeur', manualRoles: '' })).toBe('');
  });
});
