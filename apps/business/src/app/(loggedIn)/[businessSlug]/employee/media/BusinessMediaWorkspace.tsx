'use client';

import { useMemo } from 'react';
import { MediaLibrary, MediaUiProvider } from '@lawless-intranet/media-ui';
import type { MediaFolderContentsRecord, MediaLimitsRecord } from '@lawless-intranet/types';
import { createBusinessMediaActions } from '@/lib/media/mediaUiActions';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';
import { mediaShareRoute } from '@/types/routes';

type BusinessMediaWorkspaceProps = {
  businessSlug: string;
  limits: MediaLimitsRecord;
  initialFolderId: string | null;
  initialContents: MediaFolderContentsRecord;
};

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
  const { formatRpDate } = useRpCalendar();
  // Dates follow the RP calendar like the rest of the dispensary.
  const { formatMediaDate, formatMediaDateTime } = useMemo(
    () => ({
      formatMediaDate: (iso: string) => formatRpDate(new Date(iso), 'dd MMM yyyy'),
      formatMediaDateTime: (iso: string) => formatRpDate(new Date(iso), "dd MMMM yyyy 'à' HH:mm"),
    }),
    [formatRpDate],
  );

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
