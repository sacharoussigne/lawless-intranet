'use client';

import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ActionIcon, Avatar, Button, Group, Loader, Text, Textarea } from '@mantine/core';
import {
  IconArrowsSplit,
  IconCircleCheck,
  IconPencil,
  IconPlus,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import type { OrderEventRecord } from '@lawless-intranet/types';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import { MarkdownContent } from '@/app/_components/MarkdownContent/MarkdownContent';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import {
  describeOrderChange,
  describeOrderEventAction,
  formatOrderDateTime,
  personName,
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
    <div className={classes.composer}>
      <Textarea
        placeholder="Écrire un commentaire… (markdown accepté)"
        autosize
        minRows={2}
        maxRows={8}
        value={body}
        onChange={(event) => setBody(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (isSubmitShortcut(event)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">
          Ctrl + Entrée pour envoyer
        </Text>
        <Button
          size="xs"
          leftSection={<IconSend size={14} />}
          onClick={() => void submit()}
          loading={addComment.isPending}
          disabled={!body.trim()}
        >
          Envoyer
        </Button>
      </Group>
    </div>
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
    if (!draft.trim()) return;
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
      <div className={classes.commentBody}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="sm" fw={700} truncate="end">
            {name}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="dimmed">
              {formatOrderDateTime(event.createdAt)}
              {event.editedAt ? ' · modifié' : ''}
            </Text>
            {canEdit && !editing && (
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
          </Group>
        </Group>
        {editing ? (
          <div className={classes.editor}>
            <Textarea
              autosize
              minRows={2}
              maxRows={10}
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (isSubmitShortcut(e)) {
                  e.preventDefault();
                  void save();
                }
              }}
            />
            <Group justify="flex-end" gap="xs" mt="xs">
              <Button size="xs" variant="subtle" color="slate" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button
                size="xs"
                onClick={() => void save()}
                loading={updateComment.isPending}
                disabled={!draft.trim()}
              >
                Enregistrer
              </Button>
            </Group>
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
    .filter((line): line is string => Boolean(line));
  const duplicate = event.changes?.find((change) => change.field === 'duplicate');

  return (
    <li className={classes.tracking}>
      <span className={classes.trackingIcon} aria-hidden>
        {icon}
      </span>
      <div className={classes.trackingBody}>
        <Text size="sm">
          <Text span fw={700} inherit>
            {personName(people, event.actorUserId)}
          </Text>{' '}
          {describeOrderEventAction(event)}
          {duplicate?.field === 'duplicate' && (
            <>
              {duplicate.direction === 'to' ? ' en ' : ' de '}
              <Link href={routes.orders.detail(duplicate.orderId)} className={classes.link}>
                {duplicate.orderName}
              </Link>
            </>
          )}
          <Text span size="xs" c="dimmed" inherit={false}>
            {' · '}
            {formatOrderDateTime(event.createdAt)}
          </Text>
        </Text>
        {lines.length > 0 && (
          <ul className={classes.changes}>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/**
 * Chatter of an order (like Odoo's): comments of the team and the changes
 * recorded by the service, newest first, kept live by the orders realtime topic.
 */
export function OrderChatter({ orderId, currentUserId, initialChatter }: OrderChatterProps) {
  const { permissions } = usePermissions();
  const { data, isLoading } = useOrderChatter(orderId, initialChatter);
  const canDeleteAny = Boolean(permissions?.orders.delete);
  const people = data?.people ?? {};

  return (
    <section className={classes.root} aria-label="Fil de la commande">
      <h2 className={classes.title}>Fil de la commande</h2>
      <CommentComposer orderId={orderId} />
      {isLoading && !data ? (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      ) : (data?.events.length ?? 0) === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Rien pour l’instant.
        </Text>
      ) : (
        <ul className={classes.feed}>
          {data?.events.map((event) =>
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
      )}
    </section>
  );
}
