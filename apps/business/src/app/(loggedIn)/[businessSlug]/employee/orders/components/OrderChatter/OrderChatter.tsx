'use client';

import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Avatar,
  Button,
  Group,
  Loader,
  SegmentedControl,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowsSplit,
  IconCircleCheck,
  IconMessages,
  IconPencil,
  IconPlus,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import type { OrderEventRecord } from '@lawless-intranet/types';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { MarkdownContent } from '@/app/_components/MarkdownContent/MarkdownContent';
import { MarkdownTextarea } from '@/app/_components/MarkdownTextarea';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import {
  chatterDayLabel,
  describeOrderChange,
  describeOrderEventAction,
  formatOrderDateTime,
  formatOrderTime,
  groupEventsByDay,
  personName,
  splitChangeLine,
} from '@/lib/orders/chatterLines';
import type { OrderChatter as OrderChatterData, OrderPerson } from '@/types/orders';
import {
  useAddOrderCommentMutation,
  useDeleteOrderCommentMutation,
  useOrderChatter,
  useUpdateOrderCommentMutation,
} from '../../hooks/useOrdersQueries';
import classes from './OrderChatter.module.scss';

type OrderChatterProps = {
  orderId: string;
  currentUserId: string;
  initialChatter?: OrderChatterData;
};

type ChatterFilter = 'all' | 'comments';

/** Ctrl+Enter / ⌘+Enter sends. */
function isSubmitShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey);
}

function PersonAvatar({ person, name }: { person?: OrderPerson; name: string }) {
  return (
    <Avatar src={person?.image ?? null} alt="" size={32} radius="xl" color="sage">
      {name.slice(0, 1).toUpperCase()}
    </Avatar>
  );
}

/** Time of an entry; the full date in its tooltip. */
function EntryTime({ iso }: { iso: string }) {
  const rp = useRpCalendar();
  return (
    <Tooltip label={formatOrderDateTime(iso, rp)} withArrow openDelay={400}>
      <time dateTime={iso} className={classes.time}>
        {formatOrderTime(iso)}
      </time>
    </Tooltip>
  );
}

/** Message box: one frame lit on focus, the send button inside. */
function MessageBox({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  pending,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  pending: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const empty = !value.trim();
  return (
    <div className={classes.box}>
      <MarkdownTextarea
        variant="unstyled"
        placeholder={placeholder}
        autosize
        rows={2}
        minRows={2}
        maxRows={8}
        resize="none"
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        classNames={{ input: classes.boxInput }}
        onKeyDown={(event) => {
          if (isSubmitShortcut(event)) {
            event.preventDefault();
            onSubmit();
          }
          if (event.key === 'Escape' && onCancel) {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className={classes.boxFooter}>
        <Group gap={6} wrap="nowrap">
          {onCancel && (
            <Button size="compact-sm" variant="subtle" color="slate" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button
            size="compact-sm"
            color="sage"
            rightSection={<IconSend size={14} />}
            onClick={onSubmit}
            loading={pending}
            className={empty ? classes.sendIdle : undefined}
            aria-disabled={empty}
          >
            {submitLabel}
          </Button>
        </Group>
      </div>
    </div>
  );
}

function CommentComposer({ orderId }: { orderId: string }) {
  const [body, setBody] = useState('');
  const addComment = useAddOrderCommentMutation();

  const submit = async () => {
    if (!body.trim() || addComment.isPending) return;
    try {
      await addComment.mutateAsync({ orderId, body });
      setBody('');
    } catch {
      // Notified by the mutation hook; the draft is kept.
    }
  };

  return (
    <MessageBox
      value={body}
      onChange={setBody}
      onSubmit={() => void submit()}
      submitLabel="Envoyer"
      pending={addComment.isPending}
      placeholder="Écrire un commentaire…"
    />
  );
}

function CommentEntry({
  event,
  people,
  canEdit,
  canDelete,
}: {
  event: OrderEventRecord;
  people: OrderChatterData['people'];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(event.body ?? '');
  const updateComment = useUpdateOrderCommentMutation();
  const deleteComment = useDeleteOrderCommentMutation();
  const name = personName(people, event.actorUserId);

  const save = async () => {
    if (!draft.trim() || updateComment.isPending) return;
    try {
      await updateComment.mutateAsync({ orderId: event.orderId, eventId: event.id, body: draft });
      setEditing(false);
    } catch {
      // Notified by the mutation hook.
    }
  };

  return (
    <li className={classes.comment}>
      <PersonAvatar person={event.actorUserId ? people[event.actorUserId] : undefined} name={name} />
      <div className={classes.entryBody}>
        <div className={classes.entryHeader}>
          <Text span size="sm" fw={700} truncate="end">
            {name}
          </Text>
          <div className={classes.entryMeta}>
            {event.editedAt && <span className={classes.edited}>modifié</span>}
            {(canEdit || canDelete) && !editing && (
              <div className={classes.entryActions}>
                {canEdit && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="slate"
                    aria-label="Modifier le commentaire"
                    onClick={() => {
                      setDraft(event.body ?? '');
                      setEditing(true);
                    }}
                  >
                    <IconPencil size={14} />
                  </ActionIcon>
                )}
                {canDelete && (
                  <DeleteConfirmPopover
                    title="Supprimer le commentaire ?"
                    message="Le commentaire sera retiré du fil."
                    onConfirm={async () => {
                      await deleteComment
                        .mutateAsync({ orderId: event.orderId, eventId: event.id })
                        .catch(() => undefined);
                    }}
                  >
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="danger"
                      aria-label="Supprimer le commentaire"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </DeleteConfirmPopover>
                )}
              </div>
            )}
            <EntryTime iso={event.createdAt} />
          </div>
        </div>
        {editing ? (
          <div className={classes.editor}>
            <MessageBox
              value={draft}
              onChange={setDraft}
              onSubmit={() => void save()}
              onCancel={() => setEditing(false)}
              submitLabel="Enregistrer"
              pending={updateComment.isPending}
              autoFocus
            />
          </div>
        ) : (
          <div className={classes.bubble}>
            <MarkdownContent source={event.body ?? ''} />
          </div>
        )}
      </div>
    </li>
  );
}

function TrackingEntry({
  event,
  people,
}: {
  event: OrderEventRecord;
  people: OrderChatterData['people'];
}) {
  const routes = useTenantRoutes();
  const icon =
    event.kind === 'CREATED' ? (
      <IconPlus size={14} />
    ) : event.kind === 'COMPLETED' ? (
      <IconCircleCheck size={14} />
    ) : event.kind === 'DUPLICATED' ? (
      <IconArrowsSplit size={14} />
    ) : (
      <IconPencil size={14} />
    );
  const lines = (event.changes ?? [])
    .map((change) => describeOrderChange(change, people))
    .filter((line): line is string => Boolean(line))
    .map(splitChangeLine);
  const duplicate = event.changes?.find((change) => change.field === 'duplicate');

  return (
    <li className={classes.tracking}>
      <span className={classes.trackingIcon} aria-hidden>
        {icon}
      </span>
      <div className={classes.entryBody}>
        <div className={classes.entryHeader}>
          <Text span size="sm" className={classes.trackingTitle}>
            <b>{personName(people, event.actorUserId)}</b> {describeOrderEventAction(event)}
            {duplicate?.field === 'duplicate' && (
              <>
                {duplicate.direction === 'to' ? ' en ' : ' de '}
                <Link href={routes.orders.detail(duplicate.orderId)} className={classes.link}>
                  {duplicate.orderName}
                </Link>
              </>
            )}
          </Text>
          <EntryTime iso={event.createdAt} />
        </div>
        {lines.length > 0 && (
          <ul className={classes.changes}>
            {lines.map((line) => (
              <li key={`${line.label}:${line.value}`}>
                {line.label && <span className={classes.changeLabel}>{line.label}</span>}
                <span className={classes.changeValue}>{line.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Chatter of an order (like Odoo's): comments of the team and the changes
 * recorded by the service, newest first and grouped by day, kept live by the
 * orders realtime topic.
 */
export function OrderChatter({ orderId, currentUserId, initialChatter }: OrderChatterProps) {
  const rp = useRpCalendar();
  const { permissions } = usePermissions();
  const { data, isLoading } = useOrderChatter(orderId, initialChatter);
  const [filter, setFilter] = useState<ChatterFilter>('all');
  const canDeleteAny = Boolean(permissions?.orders.delete);
  const people = data?.people ?? {};
  const events = (data?.events ?? []).filter(
    (event) => filter === 'all' || event.kind === 'COMMENT',
  );
  const days = groupEventsByDay(events);

  return (
    <section className={classes.root} aria-label="Fil de la commande">
      <div className={classes.header}>
        <h2 className={classes.title}>Fil de la commande</h2>
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(value) => setFilter(value as ChatterFilter)}
          data={[
            { value: 'all', label: 'Tout' },
            { value: 'comments', label: 'Commentaires' },
          ]}
        />
      </div>

      <CommentComposer orderId={orderId} />

      {isLoading && !data ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : days.length === 0 ? (
        <div className={classes.empty}>
          <IconMessages size={28} stroke={1.4} />
          <Text size="sm">
            {filter === 'comments'
              ? 'Aucun commentaire pour l’instant.'
              : 'Aucun échange pour l’instant.'}
          </Text>
          <Text size="xs" c="dimmed">
            Laissez le premier commentaire.
          </Text>
        </div>
      ) : (
        <div className={classes.days}>
          {days.map((day) => (
            <section key={day.key} aria-label={chatterDayLabel(day.iso, rp)}>
              <div className={classes.daySeparator}>
                <span>{chatterDayLabel(day.iso, rp)}</span>
              </div>
              <ul className={classes.feed}>
                {day.events.map((event) =>
                  event.kind === 'COMMENT' ? (
                    <CommentEntry
                      key={event.id}
                      event={event}
                      people={people}
                      canEdit={event.actorUserId === currentUserId}
                      canDelete={canDeleteAny || event.actorUserId === currentUserId}
                    />
                  ) : (
                    <TrackingEntry key={event.id} event={event} people={people} />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
