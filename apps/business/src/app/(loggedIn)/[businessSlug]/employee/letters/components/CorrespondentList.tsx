'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ActionIcon, Avatar, Badge, CloseButton, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconGripVertical, IconSearch, IconUserPlus } from '@tabler/icons-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { normalizeLetterSearch } from '@/lib/letters/search';
import type { LetterCorrespondentDTO } from '@/types/letters';
import classes from '../letters.module.scss';

/** Row of the list; dragged by its grip only, so a click still opens the conversation. */
function ContactRow({ id, sortable, children }: { id: string; sortable: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });
  return (
    <div
      ref={setNodeRef}
      className={classes.contactRow}
      data-sortable={sortable || undefined}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }}
    >
      {sortable ? (
        <span
          ref={setActivatorNodeRef}
          className={classes.contactHandle}
          aria-label="Déplacer le correspondant"
          title="Glisser pour changer l’ordre"
          {...attributes}
          {...listeners}
        >
          <IconGripVertical size={14} />
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Left pane: the contacts of the box, in the order chosen by hand (shared by the box); new ones last. */
export function CorrespondentList({
  correspondents,
  selectedId,
  canWrite,
  onSelect,
  onCreate,
  onReorder,
}: {
  correspondents: LetterCorrespondentDTO[];
  selectedId: string | null;
  canWrite: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const { formatRpDate } = useRpCalendar();
  const [filter, setFilter] = useState('');
  const visible = useMemo(() => {
    const needle = normalizeLetterSearch(filter.trim());
    return needle
      ? correspondents.filter((entry) => normalizeLetterSearch(entry.name).includes(needle))
      : correspondents;
  }, [correspondents, filter]);
  // Reordering a filtered list would not say where the hidden contacts go.
  const sortable = canWrite && filter.trim() === '' && correspondents.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = correspondents.findIndex((entry) => entry.id === active.id);
    const to = correspondents.findIndex((entry) => entry.id === over.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(correspondents, from, to).map((entry) => entry.id));
  };

  return (
    <>
      <div className={classes.contactsHeader}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            style={{ flex: 1 }}
            placeholder="Filtrer les correspondants"
            leftSection={<IconSearch size={14} />}
            rightSection={filter ? <CloseButton size="xs" onClick={() => setFilter('')} aria-label="Effacer" /> : null}
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            {...noAutofillProps}
          />
          {canWrite ? (
            <Tooltip label="Nouveau correspondant">
              <ActionIcon variant="light" color="sage" onClick={() => onCreate(filter.trim())} aria-label="Nouveau correspondant">
                <IconUserPlus size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </div>
      <div className={classes.contactsList}>
        {visible.length === 0 ? (
          <Stack p="md" gap={4} align="center">
            <Text size="sm" c="dimmed" ta="center">
              {correspondents.length === 0
                ? 'Pas encore de correspondant. Ajoutez une lettre : son expéditeur apparaîtra ici.'
                : 'Aucun correspondant ne correspond.'}
            </Text>
          </Stack>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visible.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
              {visible.map((entry) => (
                <ContactRow key={entry.id} id={entry.id} sortable={sortable}>
                  <button
                    type="button"
                    className={classes.contact}
                    data-active={entry.id === selectedId || undefined}
                    onClick={() => onSelect(entry.id)}
                  >
                    <Avatar color="leather" radius="xl" size={38}>
                      {entry.name.slice(0, 1).toUpperCase()}
                    </Avatar>
                    <div className={classes.contactBody}>
                      <Group justify="space-between" gap="xs" wrap="nowrap">
                        <Text size="sm" fw={600} truncate="end">
                          {entry.name}
                        </Text>
                        {entry.lastLetterAt ? (
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {formatRpDate(entry.lastLetterAt, 'd MMM')}
                          </Text>
                        ) : null}
                      </Group>
                      <Group justify="space-between" gap="xs" wrap="nowrap">
                        <Text size="xs" c="dimmed" truncate="end">
                          {entry.lastLetter ? (
                            <>
                              {entry.lastLetter.direction === 'SENT' ? (
                                <IconArrowBackUp size={12} style={{ verticalAlign: '-2px', marginRight: 2 }} />
                              ) : null}
                              {entry.lastLetter.title}
                            </>
                          ) : (
                            'Aucune lettre'
                          )}
                        </Text>
                        {entry.letterCount > 0 ? (
                          <Badge size="xs" variant="light" color="sage" radius="xl" style={{ flexShrink: 0 }}>
                            {entry.letterCount}
                          </Badge>
                        ) : null}
                      </Group>
                    </div>
                  </button>
                </ContactRow>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </>
  );
}
