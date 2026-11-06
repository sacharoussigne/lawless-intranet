'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createRpCalendar, type RpCalendar } from '@/lib/rpCalendar';

const RpCalendarContext = createContext<RpCalendar>(createRpCalendar());

/** Gives the tenant's RP offset to the dates below. Read once in the layout from the cached settings. */
export function RpCalendarProvider({ offset, children }: { offset: number; children: ReactNode }) {
  // Only rebuilt when the setting changes, so consumers never re-render because of it.
  const value = useMemo(() => createRpCalendar(offset), [offset]);
  return <RpCalendarContext.Provider value={value}>{children}</RpCalendarContext.Provider>;
}

/** RP calendar of the current tenant (default offset outside a tenant). */
export function useRpCalendar(): RpCalendar {
  return useContext(RpCalendarContext);
}
