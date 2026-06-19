'use client';

import { Badge, Group } from '@mantine/core';

type SharedResourceAccessBadgeProps = {
  isOwner?: boolean;
  isSharedWithMe?: boolean;
  isSharedByMe?: boolean;
  accessType?: 'READ' | 'WRITE' | null;
};

export function SharedResourceAccessBadge({
  isOwner,
  isSharedWithMe,
  isSharedByMe,
  accessType,
}: SharedResourceAccessBadgeProps) {
  if (isSharedWithMe) {
    return (
      <Group gap={4} wrap="nowrap">
        <Badge variant="light" color="denim" size="sm">
          Partagé avec moi
        </Badge>
        <Badge variant="outline" color={accessType === 'WRITE' ? 'sage' : 'slate'} size="sm">
          {accessType === 'WRITE' ? 'Écriture' : 'Lecture'}
        </Badge>
      </Group>
    );
  }

  if (isOwner && isSharedByMe) {
    return (
      <Badge variant="light" color="leather" size="sm">
        Partagé
      </Badge>
    );
  }

  if (isOwner) {
    return (
      <Badge variant="light" color="slate" size="sm">
        Personnel
      </Badge>
    );
  }

  return null;
}
