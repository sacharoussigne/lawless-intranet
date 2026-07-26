'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAgendaUi } from './AgendaUiProvider';
import { runAgendaAction } from './runAgendaAction';
import { ActionIcon, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';
import dayjs from './dayjs';
import { buildDefaultTimedSlotForDay } from './dates';
import {
  AGENDA_CALENDAR_FOCUS_PARAM,
  isAgendaCalendarFocusParam,
} from './calendarNavigation';
import { useAgendaRealtime } from './realtime/useAgendaRealtime';
import { isRelevantAgendaRealtimeEvent } from './realtime/isRelevantAgendaEvent';
import {
  removeCalendarEvent,
  upsertCalendarEvent,
  type AgendaEventChange,
} from './eventState';
import { notifyUpcomingEventsLocalRefresh } from './upcomingEventsLocalRefresh';
import {
  canOwnAgenda,
  canWriteAgenda,
  type AgendaEventDTO,
  type AgendaSummaryDTO,
  type AgendaTodoListDTO,
} from './types';
import { AgendaSelector } from './components/AgendaSelector';
import type { View } from 'react-big-calendar';
import { AgendaCalendar } from './components/AgendaCalendar';
import { AgendaLayoutControls } from './components/AgendaLayoutControls';
import { AgendaTodoPanel } from './components/AgendaTodoPanel';
import { EventModal } from './components/EventModal';
import { useAgendaLayoutPreference } from './hooks/useAgendaLayoutPreference';
import {
  AGENDA_CONTAINER_MAX_WIDTH_EXPANDED_PX,
  AGENDA_PANEL_HEIGHT_EXPANDED_PX,
  AGENDA_PANEL_HEIGHT_PX,
  AGENDA_TODO_COLUMN_WIDTH_EXPANDED_PX,
  AGENDA_TODO_COLUMN_WIDTH_PX,
} from './constants';
import classes from './agenda.module.scss';

interface AgendaWorkspaceProps {
  agendas: AgendaSummaryDTO[];
  initialAgendaId: string | null;
  initialEvents: AgendaEventDTO[];
  initialTodoLists: AgendaTodoListDTO[];
  isAdmin: boolean;
  onManageMembers?: (agenda: { id: string; name: string }) => void;
}

function AgendaPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap" gap="md">
      <Stack gap={4}>
        <Title
          order={2}
          style={{ fontFamily: 'var(--disp-font-display, inherit)', fontWeight: 400 }}
        >
          {title}
        </Title>
        {description ? (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        ) : null}
      </Stack>
      {actions}
    </Group>
  );
}

export function AgendaWorkspace({
  agendas: initialAgendas,
  initialAgendaId,
  initialEvents,
  initialTodoLists,
  isAdmin,
  onManageMembers,
}: AgendaWorkspaceProps) {
  const { actions, adminHref } = useAgendaUi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agendaIdFromUrl = searchParams.get('agendaId');

  const [agendas] = useState(initialAgendas);
  const [manualAgendaId, setManualAgendaId] = useState<string | null>(null);
  const [lastUrlAgendaId, setLastUrlAgendaId] = useState(agendaIdFromUrl);
  const [events, setEvents] = useState(initialEvents);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEventDTO | null>(null);
  const [slotStart, setSlotStart] = useState<Date | null>(null);
  const [slotEnd, setSlotEnd] = useState<Date | null>(null);
  const [remoteTodosToken, setRemoteTodosToken] = useState(0);
  const [remoteEventTodosToken, setRemoteEventTodosToken] = useState(0);

  const participantOnly = agendas.length === 0 && events.length > 0;

  const urlAgendaId = useMemo(() => {
    if (participantOnly || !agendaIdFromUrl) return null;
    if (!agendas.some((agenda) => agenda.id === agendaIdFromUrl)) return null;
    return agendaIdFromUrl;
  }, [agendaIdFromUrl, agendas, participantOnly]);

  if (agendaIdFromUrl !== lastUrlAgendaId) {
    setLastUrlAgendaId(agendaIdFromUrl);
    setManualAgendaId(null);
  }

  const selectedAgendaId =
    manualAgendaId ?? urlAgendaId ?? agendas[0]?.id ?? null;

  const selectedAgenda = useMemo(
    () => agendas.find((a) => a.id === selectedAgendaId) ?? agendas[0] ?? null,
    [agendas, selectedAgendaId],
  );

  const canWrite = canWriteAgenda(selectedAgenda?.accessLevel ?? null);
  const canManageMembers =
    Boolean(onManageMembers) &&
    Boolean(selectedAgenda) &&
    (canOwnAgenda(selectedAgenda?.accessLevel) || isAdmin);
  const { layout, setWidthMode, toggleCalendar, toggleTodo } =
    useAgendaLayoutPreference();
  const [calendarFocusOverride, setCalendarFocusOverride] = useState(false);
  const calendarFocusParam = searchParams.get(AGENDA_CALENDAR_FOCUS_PARAM);

  useEffect(() => {
    if (!isAgendaCalendarFocusParam(calendarFocusParam)) return;

    setCalendarFocusOverride(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(AGENDA_CALENDAR_FOCUS_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [calendarFocusParam, pathname, router, searchParams]);

  const effectiveLayout = useMemo(
    () => ({
      ...layout,
      showCalendar: calendarFocusOverride ? true : layout.showCalendar,
    }),
    [calendarFocusOverride, layout],
  );

  const handleToggleCalendar = useCallback(() => {
    const currentlyShown = calendarFocusOverride || layout.showCalendar;
    setCalendarFocusOverride(false);
    if (currentlyShown && layout.showCalendar) {
      toggleCalendar();
    } else if (!currentlyShown) {
      toggleCalendar();
    }
  }, [calendarFocusOverride, layout.showCalendar, toggleCalendar]);

  const isExpanded = effectiveLayout.widthMode === 'expanded';
  const panelHeightPx = isExpanded ? AGENDA_PANEL_HEIGHT_EXPANDED_PX : AGENDA_PANEL_HEIGHT_PX;
  const todoColumnWidthPx = isExpanded
    ? AGENDA_TODO_COLUMN_WIDTH_EXPANDED_PX
    : AGENDA_TODO_COLUMN_WIDTH_PX;

  const layoutStyle = useMemo(
    () =>
      ({
        '--agenda-panel-height': `${panelHeightPx}px`,
        '--agenda-todo-column-width': `${todoColumnWidthPx}px`,
        '--agenda-container-max-width': `${AGENDA_CONTAINER_MAX_WIDTH_EXPANDED_PX}px`,
      }) as CSSProperties,
    [panelHeightPx, todoColumnWidthPx],
  );

  const fetchEventsRef = useRef<() => Promise<void>>(async () => {});
  const selectedAgendaIdRef = useRef(selectedAgendaId);
  const openEventIdRef = useRef<string | null>(null);

  const fetchEvents = useCallback(
    async (agendaId: string | null = selectedAgendaId) => {
      const rangeStart = dayjs().startOf('month').subtract(1, 'week').toDate();
      const rangeEnd = dayjs().endOf('month').add(1, 'week').toDate();
      const result = await actions.listEvents({
        agendaId: agendaId ?? undefined,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });
      const data = runAgendaAction(result);
      if (data) setEvents(data);
    },
    [actions, selectedAgendaId],
  );

  useEffect(() => {
    selectedAgendaIdRef.current = selectedAgendaId;
  }, [selectedAgendaId]);

  useEffect(() => {
    openEventIdRef.current = selectedEvent?.id ?? null;
  }, [selectedEvent?.id]);

  useEffect(() => {
    fetchEventsRef.current = () => fetchEvents();
  }, [fetchEvents]);

  const { clientId } = useAgendaRealtime({
    onEventsChange: (event) => {
      if (
        !isRelevantAgendaRealtimeEvent(event, {
          selectedAgendaId: selectedAgendaIdRef.current,
        })
      ) {
        return;
      }
      void fetchEventsRef.current();
    },
    onTodosChange: (event) => {
      if (
        !isRelevantAgendaRealtimeEvent(event, {
          selectedAgendaId: selectedAgendaIdRef.current,
        })
      ) {
        return;
      }
      setRemoteTodosToken((token) => token + 1);
    },
    onEventTodosChange: (payload) => {
      const openEventId = openEventIdRef.current;
      if (!openEventId || payload.eventId !== openEventId) return;
      if (
        !isRelevantAgendaRealtimeEvent(payload, {
          selectedAgendaId: selectedAgendaIdRef.current,
        })
      ) {
        return;
      }
      setRemoteEventTodosToken((token) => token + 1);
    },
  });

  useEffect(() => {
    if (!urlAgendaId || urlAgendaId === initialAgendaId) return;

    let cancelled = false;

    void (async () => {
      const rangeStart = dayjs().startOf('month').subtract(1, 'week').toDate();
      const rangeEnd = dayjs().endOf('month').add(1, 'week').toDate();
      const result = await actions.listEvents({
        agendaId: urlAgendaId,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
      });
      if (cancelled) return;
      const data = runAgendaAction(result);
      if (data) setEvents(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [actions, urlAgendaId, initialAgendaId]);

  const handleAgendaChange = useCallback(
    (agendaId: string) => {
      setManualAgendaId(agendaId);
      void fetchEvents(agendaId);

      const params = new URLSearchParams(searchParams.toString());
      if (params.get('agendaId') && params.get('agendaId') !== agendaId) {
        params.delete('agendaId');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    },
    [fetchEvents, pathname, router, searchParams],
  );

  const handleEventChange = useCallback((change: AgendaEventChange) => {
    setEvents((current) =>
      change.type === 'delete'
        ? removeCalendarEvent(current, change.id)
        : upsertCalendarEvent(current, change.event),
    );
    notifyUpcomingEventsLocalRefresh();
  }, []);

  const handleSelectEvent = async (event: AgendaEventDTO) => {
    setSelectedEvent(event);
    setSlotStart(null);
    setSlotEnd(null);
    setEventModalOpen(true);
  };

  const handleSelectSlot = (start: Date, end: Date, calendarView: View) => {
    if (!selectedAgendaId) return;
    setSelectedEvent(null);

    if (calendarView === 'month') {
      const slot = buildDefaultTimedSlotForDay(start);
      setSlotStart(slot.start);
      setSlotEnd(slot.end);
    } else {
      setSlotStart(start);
      setSlotEnd(end);
    }

    setEventModalOpen(true);
  };

  const handleCreateEvent = () => {
    if (!selectedAgendaId) return;
    setSelectedEvent(null);
    const slot = buildDefaultTimedSlotForDay(new Date());
    setSlotStart(slot.start);
    setSlotEnd(slot.end);
    setEventModalOpen(true);
  };

  if (agendas.length === 0 && !participantOnly) {
    return (
      <Container size="xl" py="xl">
        <AgendaPageHeader title="Agenda" description="Planification et listes de tâches." />
        <Stack align="center" py="xl" gap="md">
          <Text c="dimmed">Vous n&apos;avez accès à aucun agenda.</Text>
          {isAdmin && adminHref && (
            <Button component={Link} href={adminHref} color="sage">
              Gérer les agendas
            </Button>
          )}
        </Stack>
      </Container>
    );
  }

  const showCalendarPanel = Boolean(selectedAgendaId) || participantOnly;
  const showTodoPanel = !participantOnly;
  const renderCalendar = showCalendarPanel && (participantOnly || effectiveLayout.showCalendar);
  const renderTodo = showTodoPanel && effectiveLayout.showTodo;
  const eventModalAgendaId = selectedAgendaId ?? selectedEvent?.agendaId ?? '';

  const layoutClassName = [
    classes.layout,
    !renderCalendar && renderTodo ? classes.layoutTodoOnly : '',
    renderCalendar && !renderTodo ? classes.layoutCalendarOnly : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Container
      size={isExpanded ? undefined : 'xl'}
      fluid={isExpanded}
      className={isExpanded ? classes.agendaContainerExpanded : undefined}
      py="xl"
    >
      <AgendaPageHeader
        title="Agenda"
        description={
          participantOnly
            ? 'Événements auxquels vous participez.'
            : (selectedAgenda?.description ?? 'Calendrier partagé et listes de tâches.')
        }
        actions={
          <Group gap="sm">
            <AgendaLayoutControls
              layout={effectiveLayout}
              canToggleCalendar={!participantOnly}
              canToggleTodo={showTodoPanel}
              onWidthModeChange={setWidthMode}
              onToggleCalendar={handleToggleCalendar}
              onToggleTodo={toggleTodo}
            />
            {!participantOnly && (
              <>
                <AgendaSelector
                  agendas={agendas}
                  value={selectedAgendaId}
                  onChange={handleAgendaChange}
                />
                {canManageMembers && selectedAgenda && (
                  <ActionIcon
                    variant="light"
                    color="leather"
                    size="lg"
                    title="Membres"
                    aria-label="Membres"
                    onClick={() =>
                      onManageMembers?.({
                        id: selectedAgenda.id,
                        name: selectedAgenda.name,
                      })
                    }
                  >
                    <IconUsers size={18} />
                  </ActionIcon>
                )}
                {canWrite && selectedAgendaId && (
                  <Button
                    color="sage"
                    leftSection={<IconPlus size={16} />}
                    onClick={handleCreateEvent}
                  >
                    Événement
                  </Button>
                )}
              </>
            )}
          </Group>
        }
      />

      <div
        className={participantOnly ? undefined : layoutClassName}
        style={layoutStyle}
      >
        {renderCalendar && (
          <AgendaCalendar
            key={renderTodo ? 'calendar-with-todo' : 'calendar-solo'}
            agendaId={selectedAgendaId}
            events={events}
            onEventsChange={setEvents}
            canWrite={canWrite && !participantOnly}
            panelHeightPx={panelHeightPx}
            skipInitialRangeFetch
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        )}

        {renderTodo && (
          <AgendaTodoPanel
            agendaId={selectedAgendaId}
            accessLevel={selectedAgenda?.accessLevel ?? null}
            initialLists={
              selectedAgendaId === initialAgendaId ? initialTodoLists : []
            }
            skipInitialFetch={selectedAgendaId === initialAgendaId && initialTodoLists.length > 0}
            wideLayout={!renderCalendar}
            clientId={clientId}
            remoteTodosToken={remoteTodosToken}
          />
        )}
      </div>

      {eventModalAgendaId && (
        <EventModal
          opened={eventModalOpen}
          onClose={() => setEventModalOpen(false)}
          agendaId={eventModalAgendaId}
          event={selectedEvent}
          slotStart={slotStart}
          slotEnd={slotEnd}
          canWrite={canWrite && !participantOnly}
          clientId={clientId}
          remoteEventTodosToken={remoteEventTodosToken}
          onSuccess={handleEventChange}
        />
      )}
    </Container>
  );
}
