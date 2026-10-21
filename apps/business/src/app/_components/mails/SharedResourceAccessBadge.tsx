'use client';

import { Badge, Group } from '@mantine/core';

type SharedResourceAccessBadgeProps = {
  isOwner?: boolean;
  isSharedWithMe?: boolean;
  ownerName?: string | null;
  accessType?: 'READ' | 'WRITE' | null;
};

export function SharedResourceAccessBadge({
  isOwner,
  isSharedWithMe,
  ownerName,
  accessType,
}: SharedResourceAccessBadgeProps) {
  if (isOwner) {
    return (
      <Badge variant="light" color="moss" size="sm">
        Propriétaire
      </Badge>
    );
  }

  if (isSharedWithMe) {
    return (
      <Group gap={4} wrap="nowrap">
        <Badge variant="light" color="denim" size="sm">
          {ownerName ?? 'Utilisateur inconnu'}
        </Badge>
        <Badge variant="outline" color={accessType === 'WRITE' ? 'sage' : 'slate'} size="sm">
          {accessType === 'WRITE' ? 'Écriture' : 'Lecture'}
        </Badge>
      </Group>
    );
  }

  return null;
}
