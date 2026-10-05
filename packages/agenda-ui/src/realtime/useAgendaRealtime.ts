'use client';

import { useCallback, useEffect, useRef } from 'react';
import { REALTIME_DOMAIN, type RealtimeEnvelope } from '@lawless-intranet/realtime';
import {
  useOptionalRealtimeSocket,
  useRealtimeSocketEvents,
} from '@lawless-intranet/realtime/socket';
import { getOrCreateAgendaClientId } from './clientId';
import { fromAgendaRealtimeEnvelope } from './envelope';
import type { AgendaRealtimeEvent } from './types';

type UseAgendaRealtimeOptions = {
  enabled?: boolean;
  onEventsChange?: (event: AgendaRealtimeEvent) => void;
  onTodosChange?: (event: AgendaRealtimeEvent) => void;
  onEventTodosChange?: (event: AgendaRealtimeEvent) => void;
  onAgendasChange?: (event: AgendaRealtimeEvent) => void;
  onAccessChange?: (event: AgendaRealtimeEvent) => void;
};

const DOMAINS = [REALTIME_DOMAIN.agenda] as const;

/**
 * Agenda notifications over the realtime websocket (RealtimeSocketProvider).
 * The server only sends topics the user may see, so no client-side filtering
 * by agenda is needed.
 */
export function useAgendaRealtime({
  enabled = true,
  onEventsChange,
  onTodosChange,
  onEventTodosChange,
  onAgendasChange,
  onAccessChange,
}: UseAgendaRealtimeOptions) {
  const socket = useOptionalRealtimeSocket();
  const handlersRef = useRef({
    onEventsChange,
    onTodosChange,
    onEventTodosChange,
    onAgendasChange,
    onAccessChange,
  });

  useEffect(() => {
    handlersRef.current = {
      onEventsChange,
      onTodosChange,
      onEventTodosChange,
      onAgendasChange,
      onAccessChange,
    };
  });

  const handleEvent = useCallback((envelope: RealtimeEnvelope) => {
    const data = fromAgendaRealtimeEnvelope(envelope);
    const handlers = handlersRef.current;
    switch (data.type) {
      case 'events':
        handlers.onEventsChange?.(data);
        break;
      case 'todos':
        handlers.onTodosChange?.(data);
        break;
      case 'eventTodos':
        handlers.onEventTodosChange?.(data);
        break;
      case 'agendas':
        handlers.onAgendasChange?.(data);
        break;
      case 'access':
        handlers.onAccessChange?.(data);
        break;
      default:
        break;
    }
  }, []);

  useRealtimeSocketEvents({ enabled, domains: DOMAINS, onEvent: handleEvent });

  return { clientId: socket?.clientId || getOrCreateAgendaClientId() };
}
