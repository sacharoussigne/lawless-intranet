'use client';

import { useMemo } from 'react';
import { MediaLibrary, MediaUiProvider } from '@lawless-intranet/media-ui';
import type { MediaFolderContentsRecord, MediaLimitsRecord } from '@lawless-intranet/types';
import { createShelterMediaActions } from '@/lib/media/mediaUiActions';
import { formatRpDate } from '@/lib/rpCalendar';

type ShelterMediaWorkspaceProps = {
  shelterSlug: string;
  limits: MediaLimitsRecord;
  initialFolderId: string | null;
  initialContents: MediaFolderContentsRecord;
};

/** Dates follow the RP calendar like the rest of the shelter. */
const formatMediaDate = (iso: string) => formatRpDate(new Date(iso), 'dd MMM yyyy');

export function ShelterMediaWorkspace({
  shelterSlug,
  limits,
  initialFolderId,
  initialContents,
}: ShelterMediaWorkspaceProps) {
  const actions = useMemo(() => createShelterMediaActions(shelterSlug), [shelterSlug]);

  return (
    <MediaUiProvider scopeKey={shelterSlug} actions={actions} limits={limits} formatDate={formatMediaDate}>
      <MediaLibrary initialFolderId={initialFolderId} initialContents={initialContents} />
    </MediaUiProvider>
  );
}
