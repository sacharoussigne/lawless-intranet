import { describe, expect, it } from 'vitest';
import { lastAgendaCookieName, pickInitialAgendaId } from './lastAgenda';

describe('pickInitialAgendaId', () => {
  const agendas = [{ id: 'a' }, { id: 'b' }];

  it('keeps the last agenda opened while it is still accessible', () => {
    expect(pickInitialAgendaId(agendas, 'b')).toBe('b');
  });

  it('falls back to the first agenda', () => {
    expect(pickInitialAgendaId(agendas, 'gone')).toBe('a');
    expect(pickInitialAgendaId(agendas, null)).toBe('a');
    expect(pickInitialAgendaId(agendas, undefined)).toBe('a');
  });

  it('returns null without agenda', () => {
    expect(pickInitialAgendaId([], 'a')).toBeNull();
  });
});

describe('lastAgendaCookieName', () => {
  it('is scoped by tenant and cookie-safe', () => {
    expect(lastAgendaCookieName('saint-denis')).toBe('agenda-last-saint-denis');
    expect(lastAgendaCookieName('a b;c')).toBe('agenda-last-a_b_c');
  });
});
