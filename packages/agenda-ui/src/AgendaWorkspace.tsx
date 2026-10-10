'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useRealtimeSocketResync } from '@lawless-intranet/realtime/socket';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAgendaUi } from './AgendaUiProvider';
import { runAgendaAction } from './runAgendaAction';
import { ActionIcon, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';
import { buildDefaultTimedSlotForDay } from './dates';
import {
  AGENDA_CALENDAR_FOCUS_PARAM,
  isAgendaCalendarFocusParam,
} from './calendarNavigation';
import { useAgendaRealtime } from './realtime/useAgendaRealtime';
import { agendaKeys } from './queryKeys';
import { getAgendaCalendarRange, type AgendaCalendarRange } from './calendarRange';
import { useAgendaCalendarNavigation } from './hooks/useAgendaCalendarNavigation';
import {
  removeCalendarEvent,
  upsertCalendarEvent,
  type AgendaEventChange,
} from './eventState';
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
  AGENDA_FILL_BOTTOM_GAP_PX,
  AGENDA_PANEL_HEIGHT_EXPANDED_PX,
  AGENDA_PANEL_HEIGHT_PX,
  AGENDA_TODO_COLUMN_WIDTH_EXPANDED_PX,
  AGENDA_TODO_COLUMN_WIDTH_PX,
} from './constants';
import classes from './agenda.module.scss';

const EMPTY_EVENTS: AgendaEventDTO[] = [];

interface AgendaWorkspaceProps {
  agendas: AgendaSummaryDTO[];
  initialAgendaId: string | null;
  initialEvents: AgendaEventDTO[];
  /** Range used to load initialEvents (SSR), see getAgendaCalendarRange. */
  initialEventsRange?: AgendaCalendarRange;
  initialTodoLists: AgendaTodoListDTO[];
  isAdmin: boolean;
  onManageMembers?: (agenda: { id: string; name: string }) => void;
  /**
   * Phones only: the calendar or the tasks (two tabs of the mobile app). Larger
   * screens keep the side-by-side layout and its controls.
   */
  mobileView?: 'calendar' | 'tasks';
}

const PHONE_MEDIA_QUERY = '(max-width: 47.99em)';

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
    <Group justify="space-between" align="flex-start" mb={{ base: 'sm', sm: 'lg' }} wrap="wrap" gap="md">
      {/* Phones: the app bar already shows the section title. */}
      <Stack gap={4} visibleFrom="sm">
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
  agendas,
  initialAgendaId,
  initialEvents,
  initialEventsRange,
  initialTodoLists,
  isAdmin,
  onManageMembers,
  mobileView = 'calendar',
}: AgendaWorkspaceProps) {
  const { actions, adminHref, scopeKey } = useAgendaUi();
  const isPhone = useMediaQuery(PHONE_MEDIA_QUERY) ?? false;
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agendaIdFromUrl = searchParams.get('agendaId');

  const [manualAgendaId, setManualAgendaId] = useState<string | null>(null);
  const [lastUrlAgendaId, setLastUrlAgendaId] = useState(agendaIdFromUrl);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEventDTO | null>(null);
  const [slotStart, setSlotStart] = useState<Date | null>(null);
  const [slotEnd, setSlotEnd] = useState<Date | null>(null);
  const [remoteEventTodosToken, setRemoteEventTodosToken] = useState(0);

  const participantOnly = agendas.length === 0 && initialEvents.length > 0;

  const urlAgendaId = useMemo(() => {
    if (participantOnly || !agendaIdFromUrl) return null;
    if (!agendas.some((agenda) => agenda.id === agendaIdFromUrl)) return null;
    return agendaIdFromUrl;
  }, [agendaIdFromUrl, agendas, participantOnly]);

  if (agendaIdFromUrl !== lastUrlAgendaId) {
    setLastUrlAgendaId(agendaIdFromUrl);
    setManualAgendaId(null);
  }

  // The agenda list can change live (access granted/revoked): drop a stale selection.
  const manualAgendaStillVisible =
    manualAgendaId !== null && agendas.some((agenda) => agenda.id === manualAgendaId);
  const selectedAgendaId =
    (manualAgendaStillVisible ? manualAgendaId : null) ?? urlAgendaId ?? agendas[0]?.id ?? null;

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

  // Desktop, to-do alone: the panel reaches the bottom of the window instead of stopping at the
  // fixed calendar height. Measured here, then read by the CSS as `--agenda-fill-height`.
  const layoutRef = useRef<HTMLDivElement>(null);
  const todoFillsWindow =
    !isPhone &&
    !participantOnly &&
    effectiveLayout.showTodo &&
    !(selectedAgendaId && effectiveLayout.showCalendar);
  useLayoutEffect(() => {
    const element = layoutRef.current;
    if (!element || !todoFillsWindow) return;
    const setHeight = (height: number) =>
      element.style.setProperty('--agenda-fill-height', `${Math.max(0, Math.floor(height))}px`);
    const update = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      setHeight(window.innerHeight - top - AGENDA_FILL_BOTTOM_GAP_PX);
      // Whatever sits below (page paddings, wrappers) is unknown here: take back any page overflow.
      const overflow = document.documentElement.scrollHeight - window.innerHeight;
      if (overflow > 0) {
        setHeight(window.innerHeight - top - AGENDA_FILL_BOTTOM_GAP_PX - overflow);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      element.style.removeProperty('--agenda-fill-height');
    };
  }, [todoFillsWindow, selectedAgendaId]);

  // --- Events of the visible calendar range ---
  const calendarNavigation = useAgendaCalendarNavigation();
  const { rangeStart, rangeEnd } = getAgendaCalendarRange(
    calendarNavigation.view,
    calendarNavigation.date,
  );
  const eventsQueryKey = useMemo(
    () => agendaKeys.events(scopeKey, selectedAgendaId, { rangeStart, rangeEnd }),
    [scopeKey, selectedAgendaId, rangeStart, rangeEnd],
  );
  const usesInitialEvents =
    selectedAgendaId === initialAgendaId &&
    initialEventsRange?.rangeStart === rangeStart &&
    initialEventsRange?.rangeEnd === rangeEnd;

  const eventsQuery = useQuery({
    queryKey: eventsQueryKey,
    queryFn: async () =>
      runAgendaAction(
        await actions.listEvents({
          agendaId: selectedAgendaId ?? undefined,
          rangeStart,
          rangeEnd,
        }),
      ) ?? [],
    initialData: usesInitialEvents ? initialEvents : undefined,
    // Keep showing the previous range while the next one loads.
    placeholderData: keepPreviousData,
  });
  const events = eventsQuery.data ?? EMPTY_EVENTS;

  useEffect(() => {
    if (!eventsQuery.error) return;
    notifications.show({
      title: 'Erreur',
      message:
        eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Chargement impossible',
      color: 'danger',
    });
  }, [eventsQuery.error]);

  const openEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    openEventIdRef.current = eventModalOpen ? (selectedEvent?.id ?? null) : null;
  }, [eventModalOpen, selectedEvent?.id]);

  const invalidateEvents = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: agendaKeys.eventsAll(scopeKey) });
  }, [queryClient, scopeKey]);

  const { clientId } = useAgendaRealtime({
    onEventsChange: invalidateEvents,
    onEventTodosChange: (payload) => {
      if (payload.eventId && payload.eventId === openEventIdRef.current) {
        setRemoteEventTodosToken((token) => token + 1);
      }
    },
    // The agenda list comes from the server component: refresh it.
    onAgendasChange: () => router.refresh(),
    onAccessChange: () => router.refresh(),
  });

  useRealtimeSocketResync(() => {
    invalidateEvents();
    if (openEventIdRef.current) {
      setRemoteEventTodosToken((token) => token + 1);
    }
    router.refresh();
  });

  const handleAgendaChange = useCallback(
    (agendaId: string) => {
      setManualAgendaId(agendaId);

      const params = new URLSearchParams(searchParams.toString());
      if (params.get('agendaId') && params.get('agendaId') !== agendaId) {
        params.delete('agendaId');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
    },
    [pathname, router, searchParams],
  );

  const handleEventChange = useCallback(
    (change: AgendaEventChange) => {
      // Instant local feedback, then refetch every event list (calendar + header).
      queryClient.setQueryData<AgendaEventDTO[]>(eventsQueryKey, (current = []) =>
        change.type === 'delete'
          ? removeCalendarEvent(current, change.id)
          : upsertCalendarEvent(current, change.event),
      );
      invalidateEvents();
    },
    [queryClient, eventsQueryKey, invalidateEvents],
  );

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
  const renderCalendar = isPhone
    ? showCalendarPanel && mobileView === 'calendar'
    : showCalendarPanel && (participantOnly || effectiveLayout.showCalendar);
  const renderTodo = isPhone
    ? showTodoPanel && mobileView === 'tasks'
    : showTodoPanel && effectiveLayout.showTodo;
  const showCreateEvent = !isPhone || mobileView === 'calendar';
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
      py={{ base: 'xs', sm: 'xl' }}
    >
      <AgendaPageHeader
        title="Agenda"
        description={
          participantOnly
            ? 'Événements auxquels vous participez.'
            : (selectedAgenda?.description ?? 'Calendrier partagé et listes de tâches.')
        }
        actions={
          <Group gap="sm" w={{ base: '100%', sm: 'auto' }} wrap="nowrap">
            {!isPhone && (
              <AgendaLayoutControls
                layout={effectiveLayout}
                canToggleCalendar={!participantOnly}
                canToggleTodo={showTodoPanel}
                onWidthModeChange={setWidthMode}
                onToggleCalendar={handleToggleCalendar}
                onToggleTodo={toggleTodo}
              />
            )}
            {!participantOnly && (
              <>
                <div className={classes.agendaSelectorSlot}>
                  <AgendaSelector
                    agendas={agendas}
                    value={selectedAgendaId}
                    onChange={handleAgendaChange}
                  />
                </div>
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
                {canWrite && selectedAgendaId && showCreateEvent && (
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
        ref={layoutRef}
        className={participantOnly ? undefined : layoutClassName}
        style={layoutStyle}
      >
        {renderCalendar && (
          <AgendaCalendar
            key={renderTodo ? 'calendar-with-todo' : 'calendar-solo'}
            events={events}
            view={calendarNavigation.view}
            date={calendarNavigation.date}
            onViewChange={calendarNavigation.changeView}
            onNavigate={calendarNavigation.navigate}
            canWrite={canWrite && !participantOnly}
            panelHeightPx={panelHeightPx}
            compact={isPhone}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
          />
        )}

        {isPhone && mobileView === 'tasks' && !showTodoPanel && (
          <Text c="dimmed" ta="center" py="xl">
            Aucune liste de tâches pour cet agenda.
          </Text>
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
