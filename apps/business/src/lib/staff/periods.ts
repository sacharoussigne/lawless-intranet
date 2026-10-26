import type { EmploymentStatus } from './types';

/** What the pure helpers need from a stay. */
export type StayPeriod = { startedAt: Date; endedAt: Date | null };

export type RoleEvent = { occurredAt: Date; toRole: string | null };

/** The stay overlaps [from, to] (bounds included); an open stay runs until now and beyond. */
export function overlapsPeriod(stay: StayPeriod, from: Date, to: Date): boolean {
  return stay.startedAt <= to && (stay.endedAt == null || stay.endedAt >= from);
}

/** Grade held at `at`: the last hiring or grade change on or before that date. */
export function roleAt(events: RoleEvent[], at: Date): string | null {
  let current: RoleEvent | null = null;
  for (const event of events) {
    if (event.occurredAt > at) continue;
    if (!current || event.occurredAt >= current.occurredAt) current = event;
  }
  return current?.toRole ?? null;
}

export function employmentStatusOf(stays: StayPeriod[]): EmploymentStatus {
  const open = stays.find((stay) => stay.endedAt == null) ?? null;
  const leftAt = stays.reduce<Date | null>(
    (latest, stay) => (stay.endedAt && (!latest || stay.endedAt > latest) ? stay.endedAt : latest),
    null,
  );
  return {
    active: open != null,
    since: open?.startedAt ?? null,
    leftAt: open ? null : leftAt,
    stays: stays.length,
  };
}

/**
 * Why a stay cannot be placed in the history, or null. Stays never overlap and
 * at most one is open; `ignoreIndex` skips the stay being edited.
 */
export function stayConflict(
  stays: StayPeriod[],
  candidate: StayPeriod,
  ignoreIndex = -1,
): string | null {
  if (candidate.endedAt && candidate.endedAt < candidate.startedAt) {
    return 'La date de départ est avant la date d’embauche.';
  }
  for (const [index, stay] of stays.entries()) {
    if (index === ignoreIndex) continue;
    if (candidate.endedAt == null && stay.endedAt == null) {
      return 'Cette personne est déjà employée.';
    }
    const candidateEnd = candidate.endedAt ?? new Date(8.64e15);
    const stayEnd = stay.endedAt ?? new Date(8.64e15);
    if (candidate.startedAt <= stayEnd && stay.startedAt <= candidateEnd) {
      return 'Ces dates chevauchent un autre passage de cette personne.';
    }
  }
  return null;
}
