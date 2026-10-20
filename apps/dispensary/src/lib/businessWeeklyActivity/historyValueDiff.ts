import {
  formatWeekdayFlagsSummary,
  parseWeekdayFlagsJson,
  WEEKDAY_KEYS,
  type WeekdayFlags,
  type WeekdayKey,
} from '@/lib/businessWeeklyActivity/weekdayFlags';
import type { ActivitySnapshotJson } from '@/lib/businessWeeklyActivity/snapshot';
import type { WeeklyCounterDefinition } from '@/lib/businessTypes';
import { parseWeeklyCounters, weeklyCounterValue } from '@/lib/businessWeeklyActivity/counters';

const FIELD_LABELS = {
  displayName: 'Nom affiché',
  chestDays: 'Caisses',
  presenceDays: 'Présences',
} as const;

/** Counters of the business type first (their order), then any other stored key. */
function counterLines(
  definitions: readonly WeeklyCounterDefinition[],
  ...snapshots: ActivitySnapshotJson[]
): { key: string; label: string }[] {
  const known = definitions.map((c) => ({ key: c.key, label: c.label }));
  const others = [...new Set(snapshots.flatMap((snap) => Object.keys(snap.counters)))]
    .filter((key) => !definitions.some((c) => c.key === key))
    .map((key) => ({ key, label: key }));
  return [...known, ...others];
}

type BotDayFieldPayload = {
  day: WeekdayKey;
  date: string;
  chest?: boolean;
  presence?: boolean;
};

const EMPTY = '—';

function formatBool(value: boolean | undefined): string {
  if (value === undefined) return EMPTY;
  return value ? 'oui' : 'non';
}

function formatDayAnchor(day: WeekdayKey, date: string): string {
  return `${day} (${date})`;
}

function parseActivitySnapshot(raw: unknown): ActivitySnapshotJson | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if (typeof data.displayName !== 'string' || typeof data.discordUserId !== 'string') {
    return null;
  }

  return {
    periodStart: typeof data.periodStart === 'string' ? data.periodStart : '',
    periodEnd: typeof data.periodEnd === 'string' ? data.periodEnd : '',
    displayName: data.displayName,
    discordUserId: data.discordUserId,
    userId: typeof data.userId === 'string' ? data.userId : null,
    chestDays: parseWeekdayFlagsJson(data.chestDays),
    presenceDays: parseWeekdayFlagsJson(data.presenceDays),
    counters: parseWeeklyCounters(data.counters),
  };
}

function parseBotDayFieldPayload(raw: unknown): BotDayFieldPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  if ('displayName' in data || typeof data.day !== 'string' || typeof data.date !== 'string') {
    return null;
  }
  if (!WEEKDAY_KEYS.includes(data.day as WeekdayKey)) {
    return null;
  }

  return {
    day: data.day as WeekdayKey,
    date: data.date,
    chest: typeof data.chest === 'boolean' ? data.chest : undefined,
    presence: typeof data.presence === 'boolean' ? data.presence : undefined,
  };
}

function formatWeekdayFlagsDiff(before: WeekdayFlags, after: WeekdayFlags): string | null {
  const changed = WEEKDAY_KEYS.some((key) => before[key] !== after[key]);
  if (!changed) return null;
  return `${formatWeekdayFlagsSummary(before)} → ${formatWeekdayFlagsSummary(after)}`;
}

function formatSnapshotFieldLines(
  snapshot: ActivitySnapshotJson,
  definitions: readonly WeeklyCounterDefinition[],
  formatValue: (label: string, value: string) => string,
): string[] {
  return [
    formatValue(FIELD_LABELS.displayName, snapshot.displayName),
    formatValue(FIELD_LABELS.chestDays, formatWeekdayFlagsSummary(snapshot.chestDays)),
    formatValue(FIELD_LABELS.presenceDays, formatWeekdayFlagsSummary(snapshot.presenceDays)),
    ...counterLines(definitions, snapshot).map(({ key, label }) =>
      formatValue(label, String(weeklyCounterValue(snapshot.counters, key))),
    ),
  ];
}

function formatSnapshotDiff(
  prev: ActivitySnapshotJson,
  next: ActivitySnapshotJson,
  definitions: readonly WeeklyCounterDefinition[],
): string[] {
  const lines: string[] = [];

  if (prev.displayName !== next.displayName) {
    lines.push(`${FIELD_LABELS.displayName} : ${prev.displayName} → ${next.displayName}`);
  }

  const chestDiff = formatWeekdayFlagsDiff(prev.chestDays, next.chestDays);
  if (chestDiff) {
    lines.push(`${FIELD_LABELS.chestDays} : ${chestDiff}`);
  }

  const presenceDiff = formatWeekdayFlagsDiff(prev.presenceDays, next.presenceDays);
  if (presenceDiff) {
    lines.push(`${FIELD_LABELS.presenceDays} : ${presenceDiff}`);
  }

  for (const { key, label } of counterLines(definitions, prev, next)) {
    const before = weeklyCounterValue(prev.counters, key);
    const after = weeklyCounterValue(next.counters, key);
    if (before !== after) lines.push(`${label} : ${before} → ${after}`);
  }

  return lines;
}

function formatBotDayFieldChanges(previous: unknown, next: unknown): string[] {
  const prev = parseBotDayFieldPayload(previous);
  const nxt = parseBotDayFieldPayload(next);
  if (!prev || !nxt) return [];

  const dayLabel = formatDayAnchor(prev.day, prev.date);

  if (prev.chest !== undefined || nxt.chest !== undefined) {
    return [`${FIELD_LABELS.chestDays} (${dayLabel}) : ${formatBool(prev.chest)} → ${formatBool(nxt.chest)}`];
  }
  if (prev.presence !== undefined || nxt.presence !== undefined) {
    return [
      `${FIELD_LABELS.presenceDays} (${dayLabel}) : ${formatBool(prev.presence)} → ${formatBool(nxt.presence)}`,
    ];
  }

  return [];
}

export function formatHistoryValueChanges(
  action: string,
  previous: unknown,
  next: unknown,
  /** Counters of the business type, for their labels. */
  counterDefinitions: readonly WeeklyCounterDefinition[],
): string[] {
  const botLines = formatBotDayFieldChanges(previous, next);
  if (botLines.length > 0) {
    return botLines;
  }

  const prev = parseActivitySnapshot(previous);
  const nextSnap = parseActivitySnapshot(next);

  if (prev && nextSnap) {
    return formatSnapshotDiff(prev, nextSnap, counterDefinitions);
  }

  if (action === 'CREATE' && nextSnap) {
    return formatSnapshotFieldLines(nextSnap, counterDefinitions, (label, value) => `${label} : ${EMPTY} → ${value}`);
  }

  if (action === 'DELETE' && prev) {
    return formatSnapshotFieldLines(prev, counterDefinitions, (label, value) => `${label} : ${value} → ${EMPTY}`);
  }

  return [];
}
