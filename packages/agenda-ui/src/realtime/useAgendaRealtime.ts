'use client';

import { useCallback, useRef } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import { useRealtimeSubscription } from '@lawless-intranet/realtime/client';
import { fromAgendaRealtimeEnvelope } from './envelope';
import type { AgendaRealtimeEvent } from './types';

type UseAgendaRealtimeOptions = {
  enabled?: boolean;
  onEventsChange?: (event: AgendaRealtimeEvent) => void;
  onTodosChange?: (event: AgendaRealtimeEvent) => void;
  onEventTodosChange?: (event: AgendaRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.agenda] as const;

export function useAgendaRealtime({
  enabled = true,
  onEventsChange,
  onTodosChange,
  onEventTodosChange,
}: UseAgendaRealtimeOptions) {
  const handlersRef = useRef({
    onEventsChange,
    onTodosChange,
    onEventTodosChange,
  });

  handlersRef.current = {
    onEventsChange,
    onTodosChange,
    onEventTodosChange,
  };

  const handleEvent = useCallback((envelope: RealtimeEnvelope) => {
    const data = fromAgendaRealtimeEnvelope(envelope);
    switch (data.type) {
      case 'events':
        handlersRef.current.onEventsChange?.(data);
        break;
      case 'todos':
        handlersRef.current.onTodosChange?.(data);
        break;
      case 'eventTodos':
        handlersRef.current.onEventTodosChange?.(data);
        break;
      default:
        break;
    }
  }, []);

  return useRealtimeSubscription({
    enabled,
    domains: DOMAINS,
    onEvent: handleEvent,
  });
}
