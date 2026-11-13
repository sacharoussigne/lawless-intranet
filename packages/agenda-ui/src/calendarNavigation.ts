import dayjs from './dayjs';
import { formatAgendaDateInput } from './dates';

// 'agenda' = list of the next 30 days (default of the phone app).
export const AGENDA_CALENDAR_VIEWS = ['month', 'week', 'day', 'work_week', 'agenda'] as const;
export type AgendaCalendarView = (typeof AGENDA_CALENDAR_VIEWS)[number];

export const AGENDA_CALENDAR_FOCUS_PARAM = 'focus';
export const AGENDA_CALENDAR_FOCUS_VALUE = 'calendar';

export function isAgendaCalendarFocusParam(value: string | null): boolean {
  return value === AGENDA_CALENDAR_FOCUS_VALUE;
}

export function withAgendaCalendarFocus(href: string): string {
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const [path, query = ''] = withoutHash.split('?');
  const params = new URLSearchParams(query);
  params.set(AGENDA_CALENDAR_FOCUS_PARAM, AGENDA_CALENDAR_FOCUS_VALUE);
  const qs = params.toString();
  return `${path}?${qs}${hash}`;
}

/**
 * `?panels=calendar|todo`: opens the agenda on that panel only (command palette shortcuts). It
 * becomes the user's layout preference, so the toggle buttons keep working from there.
 */
export const AGENDA_PANELS_PARAM = 'panels';
export type AgendaPanel = 'calendar' | 'todo';

export function parseAgendaPanelsParam(value: string | null): AgendaPanel | null {
  return value === 'calendar' || value === 'todo' ? value : null;
}

export function withAgendaPanels(href: string, panel: AgendaPanel): string {
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const [path, query = ''] = withoutHash.split('?');
  const params = new URLSearchParams(query);
  params.set(AGENDA_PANELS_PARAM, panel);
  return `${path}?${params.toString()}${hash}`;
}

export function isAgendaCalendarView(value: string | null): value is AgendaCalendarView {
  return (AGENDA_CALENDAR_VIEWS as readonly (string | null)[]).includes(value);
}

export function parseAgendaCalendarDateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return dayjs.tz(value, 'Europe/Paris').startOf('day').toDate();
}

export function buildAgendaDayViewHref(
  agendaHref: string,
  day: Date,
  options?: { agendaId?: string },
): string {
  const params = new URLSearchParams({
    view: 'day',
    date: formatAgendaDateInput(day),
  });
  if (options?.agendaId) {
    params.set('agendaId', options.agendaId);
  }
  params.set(AGENDA_CALENDAR_FOCUS_PARAM, AGENDA_CALENDAR_FOCUS_VALUE);
  return `${agendaHref}?${params.toString()}`;
}
