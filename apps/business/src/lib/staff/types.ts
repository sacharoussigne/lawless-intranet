export const EMPLOYMENT_END_REASONS = ['RESIGNED', 'DISMISSED', 'OTHER'] as const;
export type EmploymentEndReason = (typeof EMPLOYMENT_END_REASONS)[number];

export const EMPLOYMENT_END_REASON_LABELS: Record<EmploymentEndReason, string> = {
  RESIGNED: 'Démission',
  DISMISSED: 'Licenciement',
  OTHER: 'Autre',
};

export type EmploymentEventType = 'HIRED' | 'ROLE_CHANGED' | 'LEFT';

export type EmploymentEvent = {
  id: string;
  type: EmploymentEventType;
  fromRole: string | null;
  toRole: string | null;
  endReason: EmploymentEndReason | null;
  note: string | null;
  occurredAt: Date;
  /** Name of the intranet account that recorded it, if known. */
  createdByName: string | null;
};

/** A stay of a person in the business, newest events first. */
export type Employment = {
  id: string;
  role: string | null;
  startedAt: Date;
  endedAt: Date | null;
  endReason: EmploymentEndReason | null;
  events: EmploymentEvent[];
};

/** Staff status of a person, shown in Gestion › Personnes. */
export type EmploymentStatus = {
  /** Open stay: employed since `since`. */
  active: boolean;
  since: Date | null;
  /** Last leaving date when not employed anymore. */
  leftAt: Date | null;
  /** Number of stays (comings and goings). */
  stays: number;
};
