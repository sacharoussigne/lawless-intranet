'use client';

import { useCallback, useMemo } from 'react';
import { Calendar, type View } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import dayjs from '../dayjs';
import type { AgendaEventDTO } from '../types';
import { agendaCalendarLocalizer, agendaCalendarTimeBounds } from '../calendarLocalizer';
import classes from '../agenda.module.scss';

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: AgendaEventDTO;
};

interface AgendaCalendarProps {
  events: AgendaEventDTO[];
  view: View;
  date: Date;
  onViewChange: (view: View) => void;
  onNavigate: (date: Date) => void;
  canWrite: boolean;
  panelHeightPx: number;
  onSelectEvent: (event: AgendaEventDTO) => void;
  onSelectSlot: (start: Date, end: Date, view: View) => void;
}

/** Controlled calendar: the workspace owns view/date and loads the visible range. */
export function AgendaCalendar({
  events,
  view,
  date,
  onViewChange,
  onNavigate,
  canWrite,
  panelHeightPx,
  onSelectEvent,
  onSelectSlot,
}: AgendaCalendarProps) {
  const isTimeView = view === 'week' || view === 'day' || view === 'work_week';

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      events.map((e) => {
        const start = new Date(e.startAt);
        const end = new Date(e.endAt);

        if (isTimeView && e.allDay) {
          return {
            id: e.id,
            title: e.title,
            start: dayjs(start).startOf('day').toDate(),
            end: dayjs(end).endOf('day').toDate(),
            allDay: false,
            resource: e,
          };
        }

        return {
          id: e.id,
          title: e.title,
          start,
          end,
          allDay: e.allDay,
          resource: e,
        };
      }),
    [events, isTimeView],
  );

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const className = event.resource.isParticipant
      ? 'agenda-event-participant'
      : 'agenda-event-default';
    return { className };
  }, []);

  return (
    <div className={`${classes.calendarWrapper} ${classes.calendarPanel}`}>
      <Calendar
        localizer={agendaCalendarLocalizer}
        min={agendaCalendarTimeBounds.min}
        max={agendaCalendarTimeBounds.max}
        scrollToTime={agendaCalendarTimeBounds.scrollToTime}
        dayLayoutAlgorithm="no-overlap"
        showMultiDayTimes
        allDayMaxRows={0}
        events={calendarEvents}
        view={view}
        onView={onViewChange}
        date={date}
        onNavigate={onNavigate}
        startAccessor="start"
        endAccessor="end"
        allDayAccessor="allDay"
        style={{ height: panelHeightPx }}
        culture="fr"
        messages={{
          today: "Aujourd'hui",
          previous: 'Préc.',
          next: 'Suiv.',
          month: 'Mois',
          week: 'Semaine',
          day: 'Jour',
          agenda: 'Agenda',
          date: 'Date',
          time: 'Heure',
          event: 'Événement',
          noEventsInRange: 'Aucun événement sur cette période.',
          showMore: (total) => `+${total} de plus`,
        }}
        eventPropGetter={eventPropGetter}
        onSelectEvent={(event) => onSelectEvent(event.resource)}
        selectable={canWrite}
        onSelectSlot={
          canWrite
            ? ({ start, end }) => onSelectSlot(start, end, view)
            : undefined
        }
      />
    </div>
  );
}
