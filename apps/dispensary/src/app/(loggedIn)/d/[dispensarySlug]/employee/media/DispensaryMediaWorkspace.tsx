'use client';

import { useMemo } from 'react';
import { MediaLibrary, MediaUiProvider } from '@lawless-intranet/media-ui';
import type { MediaFolderContentsRecord, MediaLimitsRecord } from '@lawless-intranet/types';
import { createDispensaryMediaActions } from '@/lib/media/mediaUiActions';
import { formatRpDate } from '@/lib/rpCalendar';
import { mediaShareRoute } from '@/types/routes';

type DispensaryMediaWorkspaceProps = {
  dispensarySlug: string;
  limits: MediaLimitsRecord;
  initialFolderId: string | null;
  initialContents: MediaFolderContentsRecord;
};

/** Dates follow the RP calendar like the rest of the dispensary. */
const formatMediaDate = (iso: string) => formatRpDate(new Date(iso), 'dd MMM yyyy');
const formatMediaDateTime = (iso: string) => formatRpDate(new Date(iso), "dd MMMM yyyy 'à' HH:mm");

/** Absolute public link, built in the browser so it uses the address the user reached us at. */
const buildShareUrl = (token: string, fileName: string) =>
  `${window.location.origin}${mediaShareRoute(token, fileName)}`;

export function DispensaryMediaWorkspace({
  dispensarySlug,
  limits,
  initialFolderId,
  initialContents,
}: DispensaryMediaWorkspaceProps) {
  const actions = useMemo(() => createDispensaryMediaActions(dispensarySlug), [dispensarySlug]);

  return (
    <MediaUiProvider
      scopeKey={dispensarySlug}
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
