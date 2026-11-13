import { describe, expect, it } from 'vitest';
import { parseAgendaPanelsParam, withAgendaPanels } from './calendarNavigation';

describe('agenda panels param', () => {
  it('reads only the known panels', () => {
    expect(parseAgendaPanelsParam('todo')).toBe('todo');
    expect(parseAgendaPanelsParam('calendar')).toBe('calendar');
    expect(parseAgendaPanelsParam('both')).toBeNull();
    expect(parseAgendaPanelsParam(null)).toBeNull();
  });

  it('adds the panel and keeps the other parameters and the hash', () => {
    expect(withAgendaPanels('/sd/employee/agenda', 'calendar')).toBe('/sd/employee/agenda?panels=calendar');
    expect(withAgendaPanels('/sd/employee/agenda?agendaId=a1#x', 'todo')).toBe(
      '/sd/employee/agenda?agendaId=a1&panels=todo#x',
    );
  });
});
