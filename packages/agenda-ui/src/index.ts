export {
  AgendaUiProvider,
  useAgendaUi,
  type AgendaActionResult,
  type AgendaUiUser,
  type AgendaUiActions,
  type AgendaUiContextValue,
  type AgendaUiProviderProps,
  type CreateAgendaEventInput,
  type UpdateAgendaEventInput,
} from './AgendaUiProvider';

export { AgendaWorkspace } from './AgendaWorkspace';
export { runAgendaAction } from './runAgendaAction';

export { useAgendaRealtime } from './realtime/useAgendaRealtime';
export { getOrCreateAgendaClientId } from './realtime/clientId';
export {
  agendaMutationMeta,
  type AgendaMutationMeta,
} from './realtime/mutationMeta';
export type { AgendaRealtimeEvent } from './realtime/types';
export { agendaKeys } from './queryKeys';
export { getAgendaCalendarRange, type AgendaCalendarRange } from './calendarRange';

export type {
  AgendaAccessLevel,
  AgendaMemberUser,
  AgendaMemberDTO,
  AgendaSummaryDTO,
  AgendaEventParticipantDTO,
  AgendaEventTodoTaskDTO,
  AgendaEventDTO,
  AgendaTodoTaskDTO,
  AgendaTodoCategoryDTO,
  AgendaTodoListDTO,
} from './types';
export {
  AGENDA_ACCESS_LEVELS,
  agendaAccessLevelLabel,
  canReadAgenda,
  canWriteAgenda,
  canOwnAgenda,
} from './types';

export {
  parseAgendaDateInput,
  parseAgendaEndDateInput,
  formatAgendaDateInput,
  formatAgendaTimeInput,
  getNextHalfHourParis,
  buildDefaultTimedSlotForDay,
  assertAgendaEventRangeValid,
} from './dates';

export {
  AGENDA_CALENDAR_VIEWS,
  AGENDA_CALENDAR_FOCUS_PARAM,
  AGENDA_CALENDAR_FOCUS_VALUE,
  type AgendaCalendarView,
  isAgendaCalendarFocusParam,
  withAgendaCalendarFocus,
  isAgendaCalendarView,
  parseAgendaCalendarDateParam,
  buildAgendaDayViewHref,
} from './calendarNavigation';

export {
  DEFAULT_AGENDA_LAYOUT,
  type AgendaLayoutPreference,
  type AgendaWidthMode,
  getAgendaLayoutStorageKey,
  readAgendaLayoutPreference,
  writeAgendaLayoutPreference,
} from './layoutPreference';
