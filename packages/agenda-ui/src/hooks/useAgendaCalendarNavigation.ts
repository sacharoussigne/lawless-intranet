'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { View } from 'react-big-calendar';
import { isAgendaCalendarView, parseAgendaCalendarDateParam } from '../calendarNavigation';
import { formatAgendaDateInput } from '../dates';

/**
 * Calendar view + date, synced with `?view=&date=`. Owned by the workspace
 * (not the calendar) so the visible range drives the events query and survives
 * calendar remounts.
 */
export function useAgendaCalendarNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const viewParam = searchParams.get('view');
  const urlView = isAgendaCalendarView(viewParam) ? viewParam : null;
  const urlDateParam = searchParams.get('date');

  const [view, setView] = useState<View>(urlView ?? 'month');
  const [date, setDate] = useState(() => parseAgendaCalendarDateParam(urlDateParam) ?? new Date());
  const [syncedParamsKey, setSyncedParamsKey] = useState(searchParamsKey);

  // External navigation (links such as "?view=day&date=...") wins over local state.
  if (searchParamsKey !== syncedParamsKey) {
    setSyncedParamsKey(searchParamsKey);
    if (urlView && urlView !== view) {
      setView(urlView);
    }
    const parsedDate = parseAgendaCalendarDateParam(urlDateParam);
    if (parsedDate && parsedDate.getTime() !== date.getTime()) {
      setDate(parsedDate);
    }
  }

  const replaceSearchParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParamsKey);
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParamsKey],
  );

  const changeView = useCallback(
    (nextView: View) => {
      setView(nextView);
      replaceSearchParams((params) => {
        if (nextView === 'month') {
          params.delete('view');
          params.delete('date');
          return;
        }
        params.set('view', nextView);
        params.set('date', formatAgendaDateInput(date));
      });
    },
    [date, replaceSearchParams],
  );

  const navigate = useCallback(
    (nextDate: Date) => {
      setDate(nextDate);
      replaceSearchParams((params) => {
        const currentView = params.get('view');
        if (isAgendaCalendarView(currentView) && currentView !== 'month') {
          params.set('date', formatAgendaDateInput(nextDate));
        }
      });
    },
    [replaceSearchParams],
  );

  return { view, date, changeView, navigate };
}
