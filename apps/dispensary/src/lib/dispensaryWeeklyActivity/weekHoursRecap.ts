import dayjs from '@/lib/dayjs';
import { getBankWeekBounds } from '@/lib/bankWeek';
import {
  WEEKDAY_KEYS,
  parseWeekdayFlagsJson,
  type WeekdayFlags,
  type WeekdayKey,
} from '@/lib/dispensaryWeeklyActivity/weekdayFlags';

const TZ = 'Europe/Paris';
const IGNORED_MORNING_START_MINUTES = 0 * 60 + 1; // 00:01
const IGNORED_MORNING_END_MINUTES = 11 * 60 + 59; // 11:59
const AFTERNOON_START_MINUTES = 12 * 60;
const AFTERNOON_END_MINUTES = 20 * 60;

export type WeekHoursRecapHistoryInput = {
  id: string;
  activityId: string;
  action: string;
  createdAt: Date;
  previousValues: unknown;
  nextValues: unknown;
};

export type WeekHoursRecapActivityInput = {
  id: string;
  displayName: string;
  discordUserId: string;
  periodStart: Date;
};

export type WeekHoursRecapDay = {
  date: string;
  openAt: string | null;
  openByActivityId: string | null;
  openByName: string | null;
  openHistoryEntryId: string | null;
  closeAt: string | null;
  closeByActivityId: string | null;
  closeByName: string | null;
  closeHistoryEntryId: string | null;
  afternoonPatientsCount: number | null;
  afternoonActivityId: string | null;
  afternoonByName: string | null;
  afternoonHistoryEntryId: string | null;
};

export type WeekHoursRecapDoctor = {
  activityId: string;
  discordUserId: string;
  displayName: string;
  days: WeekHoursRecapDay[];
};

export type WeekHoursRecapBundle = {
  days: WeekHoursRecapDay[];
  doctors: WeekHoursRecapDoctor[];
};

type TimedSignal = {
  at: Date;
  activityId: string;
  displayName: string;
  historyEntryId: string;
};

type PatientEvent = TimedSignal & {
  calendarDate: string;
  isAfternoon: boolean;
};

function parisMinutesSinceMidnight(at: Date): number {
  const m = dayjs(at).tz(TZ);
  return m.hour() * 60 + m.minute();
}

/** Events between 00:01 and 11:59 Paris are ignored entirely. */
export function isParisIgnoredMorningSlot(at: Date): boolean {
  const mins = parisMinutesSinceMidnight(at);
  return mins >= IGNORED_MORNING_START_MINUTES && mins <= IGNORED_MORNING_END_MINUTES;
}

export function isParisAfternoonSlot(at: Date): boolean {
  const mins = parisMinutesSinceMidnight(at);
  return mins >= AFTERNOON_START_MINUTES && mins <= AFTERNOON_END_MINUTES;
}

/** Calendar day in Paris for a kept event (ignored morning slots never reach this). */
export function eventCalendarDate(at: Date): string {
  return dayjs(at).tz(TZ).format('YYYY-MM-DD');
}

function parseSnapshotPatientsCount(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const count = (raw as { patientsCount?: unknown }).patientsCount;
  return typeof count === 'number' && Number.isFinite(count) ? count : null;
}

function parseSnapshotPresenceDays(raw: unknown): WeekdayFlags | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!('presenceDays' in (raw as object))) return null;
  return parseWeekdayFlagsJson((raw as { presenceDays: unknown }).presenceDays);
}

function parseBotPresencePayload(raw: unknown): { date: string; presence: boolean } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if ('displayName' in data) return null;
  if (typeof data.date !== 'string' || typeof data.presence !== 'boolean') return null;
  return { date: data.date, presence: data.presence };
}

function weekdayDateForActivity(periodStart: Date, key: WeekdayKey): string {
  const index = WEEKDAY_KEYS.indexOf(key);
  return dayjs(periodStart).tz(TZ).startOf('day').add(index, 'day').format('YYYY-MM-DD');
}

function patientDelta(entry: WeekHoursRecapHistoryInput): number {
  if (entry.action === 'INCREMENT_PATIENTS') {
    const before = parseSnapshotPatientsCount(entry.previousValues);
    const after = parseSnapshotPatientsCount(entry.nextValues);
    if (before != null && after != null && after > before) return after - before;
    return 1;
  }
  if (entry.action === 'UPDATE') {
    const before = parseSnapshotPatientsCount(entry.previousValues);
    const after = parseSnapshotPatientsCount(entry.nextValues);
    if (before == null || after == null || after <= before) return 0;
    return after - before;
  }
  return 0;
}

function extractPresenceActivations(
  entry: WeekHoursRecapHistoryInput,
  activity: WeekHoursRecapActivityInput,
): Array<{ date: string; at: Date; historyEntryId: string }> {
  if (entry.action === 'UPDATE_PRESENCE_DAYS') {
    const next = parseBotPresencePayload(entry.nextValues);
    if (next?.presence === true) {
      return [{ date: next.date, at: entry.createdAt, historyEntryId: entry.id }];
    }
    return [];
  }

  if (entry.action === 'UPDATE') {
    const prev = parseSnapshotPresenceDays(entry.previousValues);
    const next = parseSnapshotPresenceDays(entry.nextValues);
    if (!prev || !next) return [];
    const out: Array<{ date: string; at: Date; historyEntryId: string }> = [];
    for (const key of WEEKDAY_KEYS) {
      if (!prev[key] && next[key]) {
        out.push({
          date: weekdayDateForActivity(activity.periodStart, key),
          at: entry.createdAt,
          historyEntryId: entry.id,
        });
      }
    }
    return out;
  }

  return [];
}

function listWeekDates(periodStart: Date): string[] {
  const { start } = getBankWeekBounds(periodStart);
  const monday = dayjs(start).tz(TZ).startOf('day');
  return WEEKDAY_KEYS.map((_, i) => monday.add(i, 'day').format('YYYY-MM-DD'));
}

function toIso(at: Date): string {
  return at.toISOString();
}

function pickEarliest(a: TimedSignal | null, b: TimedSignal | null): TimedSignal | null {
  if (!a) return b;
  if (!b) return a;
  return a.at.getTime() <= b.at.getTime() ? a : b;
}

/**
 * Builds Mon→Sun hours recap from weekly activities + relevant history rows.
 */
export function buildWeekHoursRecap(options: {
  periodStart: Date;
  activities: WeekHoursRecapActivityInput[];
  history: WeekHoursRecapHistoryInput[];
}): WeekHoursRecapDay[] {
  return buildWeekHoursRecapBundle(options).days;
}

/**
 * Aggregate week days plus per-doctor day breakdown.
 */
export function buildWeekHoursRecapBundle(options: {
  periodStart: Date;
  activities: WeekHoursRecapActivityInput[];
  history: WeekHoursRecapHistoryInput[];
}): WeekHoursRecapBundle {
  const days = buildWeekHoursRecapForScope(options);
  const doctors = [...options.activities]
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'))
    .map((activity) => ({
      activityId: activity.id,
      discordUserId: activity.discordUserId,
      displayName: activity.displayName,
      days: buildWeekHoursRecapForScope({
        periodStart: options.periodStart,
        activities: [activity],
        history: options.history.filter((h) => h.activityId === activity.id),
      }),
    }));
  return { days, doctors };
}

function buildWeekHoursRecapForScope(options: {
  periodStart: Date;
  activities: WeekHoursRecapActivityInput[];
  history: WeekHoursRecapHistoryInput[];
}): WeekHoursRecapDay[] {
  const activityById = new Map(options.activities.map((a) => [a.id, a]));
  const weekDates = listWeekDates(options.periodStart);
  const weekDateSet = new Set(weekDates);

  const patientsByDay = new Map<string, PatientEvent[]>();
  const presenceByDay = new Map<string, TimedSignal[]>();

  const ensurePatientDay = (date: string) => {
    let list = patientsByDay.get(date);
    if (!list) {
      list = [];
      patientsByDay.set(date, list);
    }
    return list;
  };

  const ensurePresenceDay = (date: string) => {
    let list = presenceByDay.get(date);
    if (!list) {
      list = [];
      presenceByDay.set(date, list);
    }
    return list;
  };

  for (const entry of options.history) {
    if (!entry.activityId) continue;
    const activity = activityById.get(entry.activityId);
    if (!activity) continue;

    if (isParisIgnoredMorningSlot(entry.createdAt)) {
      continue;
    }

    const delta = patientDelta(entry);
    if (delta > 0) {
      const calendarDate = eventCalendarDate(entry.createdAt);
      if (weekDateSet.has(calendarDate)) {
        const event: PatientEvent = {
          at: entry.createdAt,
          activityId: activity.id,
          displayName: activity.displayName,
          historyEntryId: entry.id,
          calendarDate,
          isAfternoon: isParisAfternoonSlot(entry.createdAt),
        };
        const list = ensurePatientDay(calendarDate);
        for (let i = 0; i < delta; i += 1) {
          list.push(event);
        }
      }
    }

    for (const activation of extractPresenceActivations(entry, activity)) {
      if (!weekDateSet.has(activation.date)) continue;
      if (isParisIgnoredMorningSlot(activation.at)) continue;
      if (isParisAfternoonSlot(activation.at)) continue;
      ensurePresenceDay(activation.date).push({
        at: activation.at,
        activityId: activity.id,
        displayName: activity.displayName,
        historyEntryId: activation.historyEntryId,
      });
    }
  }

  return weekDates.map((date) => {
    const patients = patientsByDay.get(date) ?? [];
    const presence = presenceByDay.get(date) ?? [];

    const openPatientCandidates = patients.filter((p) => !p.isAfternoon);
    const earliestPatient =
      openPatientCandidates.length > 0
        ? openPatientCandidates.reduce((best, cur) =>
            cur.at.getTime() < best.at.getTime() ? cur : best,
          )
        : null;
    const earliestPresence =
      presence.length > 0
        ? presence.reduce((best, cur) => (cur.at.getTime() < best.at.getTime() ? cur : best))
        : null;

    const open = pickEarliest(earliestPatient, earliestPresence);

    const lastPatient =
      patients.length > 0
        ? patients.reduce((best, cur) => (cur.at.getTime() >= best.at.getTime() ? cur : best))
        : null;

    const afternoonPatients = patients.filter((p) => p.isAfternoon);
    const firstAfternoon = afternoonPatients.length > 0 ? afternoonPatients[0] : null;

    const hasAnySignal = Boolean(open || lastPatient || afternoonPatients.length > 0);

    return {
      date,
      openAt: open ? toIso(open.at) : null,
      openByActivityId: open?.activityId ?? null,
      openByName: open?.displayName ?? null,
      openHistoryEntryId: open?.historyEntryId ?? null,
      closeAt: lastPatient ? toIso(lastPatient.at) : null,
      closeByActivityId: lastPatient?.activityId ?? null,
      closeByName: lastPatient?.displayName ?? null,
      closeHistoryEntryId: lastPatient?.historyEntryId ?? null,
      afternoonPatientsCount: hasAnySignal ? afternoonPatients.length : null,
      afternoonActivityId: firstAfternoon?.activityId ?? null,
      afternoonByName: firstAfternoon?.displayName ?? null,
      afternoonHistoryEntryId: firstAfternoon?.historyEntryId ?? null,
    };
  });
}
