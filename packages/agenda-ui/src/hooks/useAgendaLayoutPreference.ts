'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_AGENDA_LAYOUT,
  readAgendaLayoutPreference,
  writeAgendaLayoutPreference,
  type AgendaLayoutPreference,
  type AgendaWidthMode,
} from '../layoutPreference';
import { useAgendaUi } from '../AgendaUiProvider';

export function useAgendaLayoutPreference() {
  const { scopeKey } = useAgendaUi();
  const [layout, setLayout] = useState<AgendaLayoutPreference>(DEFAULT_AGENDA_LAYOUT);

  useEffect(() => {
    setLayout(readAgendaLayoutPreference(scopeKey));
  }, [scopeKey]);

  const persist = useCallback(
    (updater: (prev: AgendaLayoutPreference) => AgendaLayoutPreference) => {
      setLayout((prev) => {
        const next = updater(prev);
        writeAgendaLayoutPreference(scopeKey, next);
        return next;
      });
    },
    [scopeKey],
  );

  const setWidthMode = useCallback(
    (widthMode: AgendaWidthMode) => {
      persist((prev) => ({ ...prev, widthMode }));
    },
    [persist],
  );

  const toggleCalendar = useCallback(() => {
    persist((prev) => {
      const nextShow = !prev.showCalendar;
      if (!nextShow && !prev.showTodo) return prev;
      return { ...prev, showCalendar: nextShow };
    });
  }, [persist]);

  const toggleTodo = useCallback(() => {
    persist((prev) => {
      const nextShow = !prev.showTodo;
      if (!nextShow && !prev.showCalendar) return prev;
      return { ...prev, showTodo: nextShow };
    });
  }, [persist]);

  return {
    layout,
    setWidthMode,
    toggleCalendar,
    toggleTodo,
  };
}
