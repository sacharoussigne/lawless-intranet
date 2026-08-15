import type {
  AnimalFollowUpMessageSide,
  AnimalFollowUpStatus,
} from '@/generated/prisma/client';

export const FOLLOW_UP_STATUS_LABELS: Record<AnimalFollowUpStatus, string> = {
  initial: 'Première lettre',
  awaiting_recipient: 'En attente du destinataire',
  no_reply: 'Sans réponse',
  awaiting_shelter: 'À répondre',
  cancelled: 'Annulé',
  validated: 'Validé',
  refused: 'Refusé',
};

export const FOLLOW_UP_STATUS_OPTIONS = (
  Object.entries(FOLLOW_UP_STATUS_LABELS) as [AnimalFollowUpStatus, string][]
)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

export const FOLLOW_UP_CLOSED_STATUSES: AnimalFollowUpStatus[] = [
  'cancelled',
  'validated',
  'refused',
];

export const FOLLOW_UP_OPEN_STATUSES: AnimalFollowUpStatus[] = [
  'initial',
  'awaiting_recipient',
  'no_reply',
  'awaiting_shelter',
];

export const FOLLOW_UP_CLOSE_OPTIONS = (
  FOLLOW_UP_CLOSED_STATUSES.map((value) => ({
    value,
    label: FOLLOW_UP_STATUS_LABELS[value],
  }))
);

export const FOLLOW_UP_STATUS_BADGE_COLORS: Record<
  AnimalFollowUpStatus,
  { color: string; variant: 'filled' }
> = {
  initial: { color: 'leather', variant: 'filled' },
  awaiting_recipient: { color: 'sageDust', variant: 'filled' },
  no_reply: { color: 'leather', variant: 'filled' },
  awaiting_shelter: { color: 'terracotta', variant: 'filled' },
  cancelled: { color: 'leather', variant: 'filled' },
  validated: { color: 'sageDust', variant: 'filled' },
  refused: { color: 'danger', variant: 'filled' },
};

export function isFollowUpClosed(status: AnimalFollowUpStatus): boolean {
  return FOLLOW_UP_CLOSED_STATUSES.includes(status);
}

export function statusAfterMessage(
  side: AnimalFollowUpMessageSide,
): AnimalFollowUpStatus {
  return side === 'shelter' ? 'awaiting_recipient' : 'awaiting_shelter';
}

export const MESSAGE_SIDE_LABELS: Record<AnimalFollowUpMessageSide, string> = {
  shelter: 'Refuge',
  recipient: 'Destinataire',
};
