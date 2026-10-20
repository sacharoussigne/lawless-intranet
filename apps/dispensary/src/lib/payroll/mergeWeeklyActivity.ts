import type { BusinessWeeklyActivity } from '@prisma/client';
import { parseWeekdayFlagsJson, type WeekdayFlags } from '@/lib/businessWeeklyActivity/weekdayFlags';
import type { PayrollReportResult } from '@/lib/payroll/schema';
import type { WeeklyCounterDefinition, WeeklyCounterPayrollStat } from '@/lib/businessTypes';
import { parseWeeklyCounters, weeklyCounterValue } from '@/lib/businessWeeklyActivity/counters';
import { cleanText, type ParsedPayrollTable, PAYROLL_DAYS } from '@/lib/payroll/parsePayrollHtmlTable';

type WaRow = BusinessWeeklyActivity & {
  resolvedDisplayName: string;
  discordProfileRole?: string | null;
  discordProfileAccountNumber?: number | null;
  user?: { name: string } | null;
};

function roleFromSources(wa: WaRow | undefined, htmlRole: string): string {
  const profileRole = wa?.discordProfileRole?.trim();
  if (profileRole) return profileRole;
  return cleanText(htmlRole ?? '');
}

function idFromSources(wa: WaRow | undefined, htmlId: number | null): number | null {
  if (wa?.discordProfileAccountNumber != null) return wa.discordProfileAccountNumber;
  return htmlId;
}

function emptyDay() {
  return { caisse: null as string | null, presence: null as string | null };
}

function emptySchedule(): PayrollReportResult['employees'][number]['schedule'] {
  return {
    lundi: emptyDay(),
    mardi: emptyDay(),
    mercredi: emptyDay(),
    jeudi: emptyDay(),
    vendredi: emptyDay(),
    samedi: emptyDay(),
    dimanche: emptyDay(),
  };
}

function scheduleFromWaFlags(chest: WeekdayFlags, presence: WeekdayFlags): PayrollReportResult['employees'][number]['schedule'] {
  const s = emptySchedule();
  for (const day of PAYROLL_DAYS) {
    s[day] = {
      caisse: chest[day] ? 'X' : null,
      presence: presence[day] ? 'P' : null,
    };
  }
  return s;
}

export function mergeScheduleOr(
  a: PayrollReportResult['employees'][number]['schedule'],
  b: PayrollReportResult['employees'][number]['schedule'],
): PayrollReportResult['employees'][number]['schedule'] {
  const out = emptySchedule();
  for (const day of PAYROLL_DAYS) {
    const x = a[day];
    const y = b[day];
    out[day] = {
      caisse: x.caisse === 'X' || y.caisse === 'X' ? 'X' : null,
      presence: x.presence === 'P' || y.presence === 'P' ? 'P' : null,
    };
  }
  return out;
}

/** Payroll stats filled from the counters of a row (lib/businessTypes `payrollStat`). */
function payrollStatsOf(
  wa: WaRow | undefined,
  counterDefinitions: readonly WeeklyCounterDefinition[],
): Record<WeeklyCounterPayrollStat, number> {
  const stats: Record<WeeklyCounterPayrollStat, number> = {
    sherifs: 0,
    patients_soignes: 0,
    poppy_milk_offertes: 0,
    infusions_ginseng_offertes: 0,
  };
  if (!wa) return stats;
  const counters = parseWeeklyCounters(wa.counters);
  for (const c of counterDefinitions) {
    if (c.payrollStat) stats[c.payrollStat] += weeklyCounterValue(counters, c.key);
  }
  return stats;
}

function numMax(a: number | null | undefined, b: number | null | undefined): number {
  return Math.max(a ?? 0, b ?? 0);
}

/** Stable name key: lowercase, strip combining marks, trim. */
export function payrollNameKey(raw: string): string {
  const t = cleanText(raw).toLowerCase();
  try {
    return t.normalize('NFD').replace(/\p{M}/gu, '');
  } catch {
    return t;
  }
}

function waNameKeys(a: WaRow): string[] {
  const keys = new Set<string>();
  const r = cleanText(a.resolvedDisplayName);
  if (r) keys.add(payrollNameKey(r));
  const d = cleanText(a.displayName);
  if (d) keys.add(payrollNameKey(d));
  return [...keys];
}

/**
 * One activity per name key; first row wins for each key (later rows skip the keys already taken).
 * Returns duplicate activity ids that could not get a key (for diagnostics).
 */
export function buildWeeklyActivityByNameKey(activities: WaRow[]): { map: Map<string, WaRow>; duplicateSkips: string[] } {
  const map = new Map<string, WaRow>();
  const duplicateSkips: string[] = [];
  for (const a of activities) {
    const keys = waNameKeys(a);
    if (keys.length === 0) {
      duplicateSkips.push(a.id);
      continue;
    }
    // Every free key (fixed name and name sent by the bot) points to the row,
    // so the payroll HTML matches whichever name it uses.
    let anyNew = false;
    for (const k of keys) {
      if (!k) continue;
      if (!map.has(k)) {
        map.set(k, a);
        anyNew = true;
      }
    }
    if (!anyNew) {
      duplicateSkips.push(a.id);
    }
  }
  return { map, duplicateSkips };
}

/**
 * Merges parsed HTML with weekly activity rows: union of people, OR schedules, max numeric stats.
 */
export function mergeHtmlAndWeeklyActivity(
  parsed: ParsedPayrollTable,
  activities: WaRow[],
  /** Counters of the business type: those with a `payrollStat` feed the payroll. */
  counterDefinitions: readonly WeeklyCounterDefinition[],
): PayrollReportResult['employees'] {
  const { map: waByNameKey } = buildWeeklyActivityByNameKey(activities);
  const matchedActIds = new Set<string>();
  const out: PayrollReportResult['employees'] = [];

  for (const row of parsed.employees) {
    const nk = payrollNameKey(cleanText(row.name ?? ''));
    const wa = nk ? waByNameKey.get(nk) : undefined;
    if (wa) {
      matchedActIds.add(wa.id);
    }

    const waStats = payrollStatsOf(wa, counterDefinitions);
    const sSher = Math.max(row.stats.sherifs ?? 0, waStats.sherifs);
    const patients = Math.max(row.stats.patients_soignes ?? 0, waStats.patients_soignes);

    let schedule = row.schedule as PayrollReportResult['employees'][number]['schedule'];
    if (wa) {
      const ch = parseWeekdayFlagsJson(wa.chestDays);
      const pr = parseWeekdayFlagsJson(wa.presenceDays);
      const waSched = scheduleFromWaFlags(ch, pr);
      schedule = mergeScheduleOr(
        row.schedule as PayrollReportResult['employees'][number]['schedule'],
        waSched,
      );
    }

    out.push({
      // The dispensary name of the person (fixed name first) when the row is matched.
      name: (wa && cleanText(wa.resolvedDisplayName)) || cleanText(row.name ?? ''),
      role: roleFromSources(wa, row.role ?? ''),
      id: idFromSources(wa, row.id),
      salary_supplement_usd: 0,
      schedule,
      stats: {
        nombre_caisses: row.stats.nombre_caisses,
        nombre_presences: row.stats.nombre_presences,
        patients_soignes: patients,
        poppy_milk_offertes: numMax(0, waStats.poppy_milk_offertes),
        infusions_ginseng_offertes: numMax(0, waStats.infusions_ginseng_offertes),
        sherifs: sSher > 0 ? sSher : null,
        palefreniers: row.stats.palefreniers,
      },
    });
  }

  for (const wa of activities) {
    if (matchedActIds.has(wa.id)) continue;
    const ch = parseWeekdayFlagsJson(wa.chestDays);
    const pr = parseWeekdayFlagsJson(wa.presenceDays);
    const schedule = scheduleFromWaFlags(ch, pr);
    const label = cleanText(wa.resolvedDisplayName) || cleanText(wa.displayName) || '—';
    const waStats = payrollStatsOf(wa, counterDefinitions);
    out.push({
      name: label,
      role: roleFromSources(wa, ''),
      id: idFromSources(wa, null),
      salary_supplement_usd: 0,
      schedule,
      stats: {
        sherifs: waStats.sherifs > 0 ? waStats.sherifs : null,
        palefreniers: null,
        nombre_caisses: 0,
        nombre_presences: 0,
        patients_soignes: waStats.patients_soignes,
        poppy_milk_offertes: waStats.poppy_milk_offertes,
        infusions_ginseng_offertes: waStats.infusions_ginseng_offertes,
      },
    });
  }

  return out;
}

export type { WaRow };
