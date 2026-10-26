import { describe, expect, it } from 'vitest';
import { appendIdleStaff, withStaffRoles } from './staffOfWeek';
import type { WaRow } from './mergeWeeklyActivity';
import type { StaffMemberOfPeriod } from '@/lib/staff/service';

const member = (discordUserId: string, displayName: string, role: string | null): StaffMemberOfPeriod => ({
  discordUserId,
  displayName,
  role,
  accountNumber: 42,
  caisseUnitUsd: null,
});

describe('withStaffRoles', () => {
  it('uses the grade of the week for employed people only', () => {
    const rows = [
      { discordUserId: '1', discordProfileRole: 'Médecin' },
      { discordUserId: '2', discordProfileRole: 'Infirmier' },
    ] as WaRow[];
    const out = withStaffRoles(rows, [member('1', 'Ada', 'Apprentie')]);
    expect(out.map((row) => row.discordProfileRole)).toEqual(['Apprentie', 'Infirmier']);
  });
});

describe('appendIdleStaff', () => {
  it('adds an empty line for employed people without activity', () => {
    const out = appendIdleStaff([], [{ discordUserId: '1' }], [member('1', 'Ada', 'Médecin'), member('2', 'Béa', 'Apprentie')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Béa', role: 'Apprentie', id: 42, stats: { patients_soignes: 0 } });
  });

  it('does not duplicate a person already listed under the same name', () => {
    const [ada] = appendIdleStaff([], [], [member('1', 'Ada', 'Médecin')]);
    expect(appendIdleStaff([ada], [], [member('1', 'Ada', 'Médecin')])).toHaveLength(1);
  });
});
