export type AgendaWidthMode = 'normal' | 'expanded';

export type AgendaLayoutPreference = {
  widthMode: AgendaWidthMode;
  showCalendar: boolean;
  showTodo: boolean;
};

export const DEFAULT_AGENDA_LAYOUT: AgendaLayoutPreference = {
  widthMode: 'normal',
  showCalendar: true,
  showTodo: true,
};

export function getAgendaLayoutStorageKey(scopeKey: string) {
  return `agenda-layout:${scopeKey}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readAgendaLayoutPreference(
  scopeKey: string,
): AgendaLayoutPreference {
  if (!canUseStorage()) return DEFAULT_AGENDA_LAYOUT;

  try {
    const raw = window.localStorage.getItem(getAgendaLayoutStorageKey(scopeKey));
    if (!raw) return DEFAULT_AGENDA_LAYOUT;

    const parsed = JSON.parse(raw) as Partial<AgendaLayoutPreference>;
    const widthMode = parsed.widthMode === 'expanded' ? 'expanded' : 'normal';
    const showCalendar = parsed.showCalendar !== false;
    const showTodo = parsed.showTodo !== false;

    if (!showCalendar && !showTodo) {
      return DEFAULT_AGENDA_LAYOUT;
    }

    return { widthMode, showCalendar, showTodo };
  } catch {
    return DEFAULT_AGENDA_LAYOUT;
  }
}

export function writeAgendaLayoutPreference(
  scopeKey: string,
  preference: AgendaLayoutPreference,
) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    getAgendaLayoutStorageKey(scopeKey),
    JSON.stringify(preference),
  );
}
