import { describe, expect, it } from 'vitest';
import { buildUserTemplateRenderContext, renderTemplate } from '@lawless-intranet/mail-template-engine';
import {
  buildPayrollLetterVariables,
  DEFAULT_PAYROLL_LETTER_CONTENT,
  rpWeekRange,
  SAMPLE_PAYROLL_LETTER_VARIABLES,
} from './variables';

const day = (presence: boolean) => ({ caisse: null, presence: presence ? 'P' : null });

function employee(name: string, role: string, presences: boolean[], patients: number, sherifs: number | null) {
  const [lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche] = presences.map(day);
  return {
    name,
    role,
    id: name === 'Ada' ? 6408 : null,
    schedule: { lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche },
    stats: {
      sherifs,
      palefreniers: null,
      nombre_caisses: 0,
      nombre_presences: 0,
      patients_soignes: patients,
      poppy_milk_offertes: 0,
      infusions_ginseng_offertes: 0,
    },
    salary_supplement_usd: 0,
  };
}

describe('buildPayrollLetterVariables', () => {
  const result = {
    employees: [
      employee('Zoé', 'Apprentie', [false, false, false, false, false, false, false], 0, null),
      employee('Ada', 'Médecin', [true, false, true, false, false, false, false], 12, 2),
      employee('Bob', '', [true, true, true, true, true, true, true], 5, 1),
    ],
  };
  const vars = buildPayrollLetterVariables({
    weekStart: new Date(2026, 9, 5),
    weekEnd: new Date(2026, 9, 11, 23, 59),
    result,
    genderOf: (e) => (e.name === 'Ada' ? 'female' : null),
    now: new Date(2026, 9, 12),
  });

  it('writes one paragraph per graded employee, by name', () => {
    expect(vars.employes).toBe(
      [
        'Ada, numéro de compte 6408, a été présente 2 fois cette semaine pour effectuer des soins et consultations.',
        'Zoé, numéro de compte INCONNU, a été présente 0 fois cette semaine pour effectuer des soins et consultations.',
      ].join('\n\n'),
    );
    expect(vars.nb_employes).toBe('2');
    expect(vars.total_presences).toBe('2');
  });

  it('counts patients and sheriffs over the whole report', () => {
    expect(vars.total_patients).toBe('17');
    expect(vars.total_sherifs).toBe('3');
  });

  it('writes the dates in the RP calendar', () => {
    expect(vars.semaine).toBe('du 5 au 11 octobre 1890');
    expect(vars.semaine_debut).toBe('5 octobre 1890');
    expect(vars.date_courrier).toBe('12 octobre 1890');
  });
});

describe('rpWeekRange', () => {
  it('names both months when the week spans two', () => {
    expect(rpWeekRange(new Date(2026, 8, 28), new Date(2026, 9, 4))).toBe('du 28 septembre au 4 octobre 1890');
  });

  it('names both years when the week spans two', () => {
    expect(rpWeekRange(new Date(2026, 11, 28), new Date(2027, 0, 3))).toBe('du 28 décembre 1890 au 3 janvier 1891');
  });
});

describe('DEFAULT_PAYROLL_LETTER_CONTENT', () => {
  const render = (gender: 'male' | 'female') =>
    renderTemplate(
      DEFAULT_PAYROLL_LETTER_CONTENT,
      buildUserTemplateRenderContext({
        inputs: {},
        username: 'Dr. Owen Clark',
        userDescription: 'Directeur du Dispensaire de Saint-Denis',
        userGender: gender,
        variables: SAMPLE_PAYROLL_LETTER_VARIABLES,
      }),
    );

  it('renders the whole letter', () => {
    const text = render('male');
    expect(text).toContain('Semaine du 5 au 11 octobre 1890\nMédecin responsable : Dr. Owen Clark');
    expect(text).toContain('Je soussigné, Dr. Owen Clark, certifie');
    expect(text).toContain('a été présente 5 fois cette semaine');
    expect(text).toContain('Au total, 11 shérifs et 13 patients ont été soignés');
    expect(text).toContain('Fait à Saint-Denis, le 12 octobre 1890\n\nDr. Owen Clark\nDirecteur du Dispensaire de Saint-Denis');
    expect(text).not.toMatch(/\$\{|\{if:/);
  });

  it('agrees « soussignée » with the author', () => {
    expect(render('female')).toContain('Je soussignée, Dr. Owen Clark');
  });
});
