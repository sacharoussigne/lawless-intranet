'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Button,
  Indicator,
  Popover,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconClipboardList } from '@tabler/icons-react';
import { formatRpDate } from '@/lib/rpCalendar';
import {
  useOpenWaitRequestsPreview,
  useWaitlistRealtimeInvalidation,
} from '@/lib/waitlist/useWaitlistQueries';
import type { OpenWaitRequestsPreview } from '@/types/animalWaitRequests';
import { parseIsoDateOnly } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';

const EMPTY_PREVIEW: OpenWaitRequestsPreview = { count: 0, items: [] };

type HeaderWaitlistIndicatorProps = {
  shelterSlug: string;
  waitlistHref: string;
};

function formatRequestLabel(item: OpenWaitRequestsPreview['items'][number]) {
  const animalLabel = item.breedName
    ? `${item.speciesName} / ${item.breedName}`
    : item.speciesName;
  return `${item.requesterName} · ${animalLabel}`;
}

export function HeaderWaitlistIndicator({
  shelterSlug,
  waitlistHref,
}: HeaderWaitlistIndicatorProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const previewQuery = useOpenWaitRequestsPreview(shelterSlug);
  const preview = previewQuery.data ?? EMPTY_PREVIEW;
  const loading = previewQuery.isPending;
  useWaitlistRealtimeInvalidation(shelterSlug);

  const { refetch } = previewQuery;
  const handlePopoverChange = useCallback(
    (value: boolean) => {
      setOpened(value);
      if (value) void refetch();
    },
    [refetch],
  );

  const hasOpen = preview.count > 0;

  const handleIndicatorClick = () => {
    if (loading) return;
    if (!hasOpen) {
      router.push(waitlistHref);
      return;
    }
    handlePopoverChange(!opened);
  };

  const button = (
    <ActionIcon
      variant="light"
      color="terracotta"
      size="lg"
      aria-label={
        hasOpen
          ? `${preview.count} demande${preview.count > 1 ? 's' : ''} en cours`
          : 'File d’attente'
      }
      onClick={handleIndicatorClick}
    >
      <IconClipboardList size={20} stroke={1.5} />
    </ActionIcon>
  );

  if (!hasOpen) {
    return (
      <Tooltip label="File d’attente" position="bottom">
        <Indicator inline processing={loading} disabled color="terracotta" size={18}>
          {button}
        </Indicator>
      </Tooltip>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={handlePopoverChange}
      position="bottom-end"
      width={320}
      withinPortal
    >
      <Popover.Target>
        <Indicator
          inline
          processing={loading}
          disabled={loading}
          color="terracotta"
          label={preview.count > 9 ? '9+' : preview.count}
          size={18}
        >
          {button}
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Text fw={600} size="sm" className="shelter-display-title">
            Demandes en cours
          </Text>
          <Stack gap={6}>
            {preview.items.map((item) => (
              <div key={item.id}>
                <Text size="sm" fw={500} lineClamp={1}>
                  {formatRequestLabel(item)}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatRpDate(parseIsoDateOnly(item.requestedAt), 'dd/MM/yyyy')}
                </Text>
              </div>
            ))}
          </Stack>
          <Button
            component={Link}
            href={waitlistHref}
            color="terracotta"
            variant="light"
            size="xs"
            onClick={() => setOpened(false)}
          >
            Voir la file d’attente
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
