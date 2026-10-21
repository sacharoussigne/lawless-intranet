'use client';

import { useMemo } from 'react';
import { MediaLibrary, MediaUiProvider } from '@lawless-intranet/media-ui';
import type { MediaFolderContentsRecord, MediaLimitsRecord } from '@lawless-intranet/types';
import { createBusinessMediaActions } from '@/lib/media/mediaUiActions';
import { formatRpDate } from '@/lib/rpCalendar';
import { mediaShareRoute } from '@/types/routes';

type BusinessMediaWorkspaceProps = {
  businessSlug: string;
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

export function BusinessMediaWorkspace({
  businessSlug,
  limits,
  initialFolderId,
  initialContents,
}: BusinessMediaWorkspaceProps) {
  const actions = useMemo(() => createBusinessMediaActions(businessSlug), [businessSlug]);

  return (
    <MediaUiProvider
      scopeKey={businessSlug}
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
