'use client';

import { useMemo } from 'react';
import { MediaLibrary, MediaUiProvider } from '@lawless-intranet/media-ui';
import type { MediaFolderContentsRecord, MediaLimitsRecord } from '@lawless-intranet/types';
import { createShelterMediaActions } from '@/lib/media/mediaUiActions';
import { formatRpDate } from '@/lib/rpCalendar';
import { mediaShareRoute } from '@/types/routes';

type ShelterMediaWorkspaceProps = {
  shelterSlug: string;
  limits: MediaLimitsRecord;
  initialFolderId: string | null;
  initialContents: MediaFolderContentsRecord;
};

/** Dates follow the RP calendar like the rest of the shelter. */
const formatMediaDate = (iso: string) => formatRpDate(new Date(iso), 'dd MMM yyyy');
const formatMediaDateTime = (iso: string) => formatRpDate(new Date(iso), "dd MMMM yyyy 'à' HH:mm");

/** Absolute public link, built in the browser so it uses the address the user reached us at. */
const buildShareUrl = (token: string, fileName: string) =>
  `${window.location.origin}${mediaShareRoute(token, fileName)}`;

export function ShelterMediaWorkspace({
  shelterSlug,
  limits,
  initialFolderId,
  initialContents,
}: ShelterMediaWorkspaceProps) {
  const actions = useMemo(() => createShelterMediaActions(shelterSlug), [shelterSlug]);

  return (
    <MediaUiProvider
      scopeKey={shelterSlug}
      actions={actions}
      limits={limits}
      formatDate={formatMediaDate}
      formatDateTime={formatMediaDateTime}
      buildShareUrl={buildShareUrl}
    >
      <MediaLibrary initialFolderId={initialFolderId} initialContents={initialContents} />
    </MediaUiProvider>
  );
}
