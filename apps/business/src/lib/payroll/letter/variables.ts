import { isCashPreparerGrade, isPayrollEmployeeRole } from '@/lib/businessDiscordProfile/constants';
import { PAYROLL_DAYS } from '@/lib/payroll/parsePayrollHtmlTable';
import type { PayrollReportResult } from '@/lib/payroll/schema';
import { formatRpDate } from '@/lib/rpCalendar';

/** Type of the city hall letter template in the documents service (one per business). */
export const PAYROLL_LETTER_TEMPLATE_TYPE = 'payroll-letter';

/** Variables of the city hall letter, offered by `@` in its editor (author variables come with every template). */
export const PAYROLL_LETTER_VARIABLE_DESCRIPTIONS = {
  semaine: 'Semaine du rapport, ex. « du 5 au 11 octobre 1890 »',
  semaine_debut: 'Premier jour de la semaine du rapport, ex. « 5 octobre 1890 »',
  semaine_fin: 'Dernier jour de la semaine du rapport, ex. « 11 octobre 1890 »',
  date_courrier: 'Date RP du jour où la lettre est générée',
  employes: 'Un paragraphe par employé : nom, n° de compte et nombre de présences',
  nb_employes: 'Nombre d’employés de la liste',
  total_presences: 'Total des jours de présence des employés',
  total_patients: 'Total des patients soignés',
  total_sherifs: 'Total des shérifs soignés',
  username: 'Nom de l’auteur du courrier',
  description: 'Description (fonction) de l’auteur du courrier',
  gender: 'Genre de l’auteur : male ou female',
} as const;

export type PayrollLetterVariables = Record<
  Exclude<keyof typeof PAYROLL_LETTER_VARIABLE_DESCRIPTIONS, 'username' | 'description' | 'gender'>,
  string
>;

type PayrollEmployee = PayrollReportResult['employees'][number];

export type LetterGender = 'male' | 'female';

/** Feminine grades: the fallback when the person's account gives no gender. */
const FEMININE_ROLES = new Set([
  'Apprentie',
  'Infirmière',
  'Directrice',
  'Co-Directrice',
  'Préparatrice de caisses',
]);

/**
 * The letter lists the employees: lines with a payroll grade (the staff, see appendIdleStaff),
 * except the préparateurs de caisses, who are not care staff.
 */
export function letterEmployees(employees: PayrollEmployee[]): PayrollEmployee[] {
  return employees
    .filter(
      (employee) =>
        isPayrollEmployeeRole(employee.role.trim()) && !isCashPreparerGrade(employee.role),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function presenceCount(employee: PayrollEmployee): number {
  return PAYROLL_DAYS.filter((day) => employee.schedule[day].presence === 'P').length;
}

function employeeParagraph(employee: PayrollEmployee, gender: LetterGender | null): string {
  const feminine = (gender ?? (FEMININE_ROLES.has(employee.role.trim()) ? 'female' : 'male')) === 'female';
  const account = employee.id != null ? String(employee.id) : 'INCONNU';
  return `${employee.name}, numéro de compte ${account}, a été présent${feminine ? 'e' : ''} ${presenceCount(employee)} fois cette semaine pour effectuer des soins et consultations.`;
}

/** « du 5 au 11 octobre 1890 », « du 29 septembre au 5 octobre 1890 », across years too. */
export function rpWeekRange(weekStart: Date, weekEnd: Date): string {
  const sameYear = formatRpDate(weekStart, 'yyyy') === formatRpDate(weekEnd, 'yyyy');
  const sameMonth = sameYear && formatRpDate(weekStart, 'MM') === formatRpDate(weekEnd, 'MM');
  const startPattern = sameMonth ? 'd' : sameYear ? 'd MMMM' : 'd MMMM yyyy';
  return `du ${formatRpDate(weekStart, startPattern)} au ${formatRpDate(weekEnd, 'd MMMM yyyy')}`;
}

/**
 * Variables of the city hall letter, from a payroll report: the template engine
 * has no loop, so the employee list is one pre-formatted text (like `items` for orders).
 * Totals cover the whole report (every line), presences only the listed employees.
 */
export function buildPayrollLetterVariables(input: {
  weekStart: Date;
  weekEnd: Date;
  result: Pick<PayrollReportResult, 'employees'>;
  /** Gender of a line's person (intranet account), null when unknown: the grade decides. */
  genderOf?: (employee: PayrollEmployee) => LetterGender | null;
  now?: Date;
}): PayrollLetterVariables {
  const employees = letterEmployees(input.result.employees);
  const all = input.result.employees;
  const genderOf = input.genderOf ?? (() => null);
  return {
    semaine: rpWeekRange(input.weekStart, input.weekEnd),
    semaine_debut: formatRpDate(input.weekStart, 'd MMMM yyyy'),
    semaine_fin: formatRpDate(input.weekEnd, 'd MMMM yyyy'),
    date_courrier: formatRpDate(input.now ?? new Date(), 'd MMMM yyyy'),
    employes: employees.map((employee) => employeeParagraph(employee, genderOf(employee))).join('\n\n'),
    nb_employes: String(employees.length),
    total_presences: String(employees.reduce((sum, e) => sum + presenceCount(e), 0)),
    total_patients: String(all.reduce((sum, e) => sum + (e.stats.patients_soignes ?? 0), 0)),
    total_sherifs: String(all.reduce((sum, e) => sum + (e.stats.sherifs ?? 0), 0)),
  };
}

/** Sample values for the editor's preview. */
export const SAMPLE_PAYROLL_LETTER_VARIABLES: PayrollLetterVariables = {
  semaine: 'du 5 au 11 octobre 1890',
  semaine_debut: '5 octobre 1890',
  semaine_fin: '11 octobre 1890',
  date_courrier: '12 octobre 1890',
  employes: [
    'Dr. Owen Clark, numéro de compte 5154, a été présent 5 fois cette semaine pour effectuer des soins et consultations.',
    'Dr. Violet Clark, numéro de compte 5374, a été présente 5 fois cette semaine pour effectuer des soins et consultations.',
    'Monsieur Reagan Craft, numéro de compte INCONNU, a été présent 0 fois cette semaine pour effectuer des soins et consultations.',
  ].join('\n\n'),
  nb_employes: '3',
  total_presences: '10',
  total_patients: '13',
  total_sherifs: '11',
};

/** Starting text of the letter, offered while the business has none. */
export const DEFAULT_PAYROLL_LETTER_CONTENT = [
  'Semaine ${semaine}',
  'Médecin responsable : ${username}',
  'Numéro de compte du Dispensaire : à compléter',
  '',
  '{if:[var="gender"][eq="female"][then="Je soussignée"][else="Je soussigné"]}, ${username}, certifie la présence des membres du Dispensaire durant la semaine écoulée, dans le cadre de l’attribution des subventions hebdomadaires aux médecins de Saint-Denis.',
  '',
  '${employes}',
  '',
  'Le Dispensaire compte actuellement ${nb_employes} membres du personnel soignant.',
  'Au total, ${total_sherifs} shérifs et ${total_patients} patients ont été soignés au cours de la semaine.',
  '',
  'Fait à Saint-Denis, le ${date_courrier}',
  '',
  '${username}',
  '${description}',
].join('\n');
