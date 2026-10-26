import { describe, expect, it } from 'vitest';
import { groupStaffByGrade } from './orgChart';

const p = (displayName: string, role: string | null) => ({ displayName, role });

describe('groupStaffByGrade', () => {
  it('orders the levels from the top and groups both genders', () => {
    const levels = groupStaffByGrade([
      p('Zoé', 'Apprentie'),
      p('Bob', 'Médecin'),
      p('Ada', 'Directrice'),
      p('Luc', 'Apprenti'),
    ]);
    expect(levels.map((l) => [l.label, l.people.map((x) => x.displayName)])).toEqual([
      ['Direction', ['Ada']],
      ['Médecins', ['Bob']],
      ['Apprentis', ['Luc', 'Zoé']],
    ]);
  });

  it('puts missing or unknown grades last', () => {
    const levels = groupStaffByGrade([p('Eve', null), p('Max', 'Palefrenier'), p('Bob', 'Médecin')]);
    expect(levels.map((l) => l.label)).toEqual(['Médecins', 'Sans grade']);
    expect(levels[1]?.people.map((x) => x.displayName)).toEqual(['Eve', 'Max']);
  });
});
