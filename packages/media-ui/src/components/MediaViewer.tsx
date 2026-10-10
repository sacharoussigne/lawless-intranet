'use client';

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ActionIcon, Box, Button, Center, Group, Image, Loader, Modal, Stack, Text, Tooltip } from '@mantine/core';
import { useMediaQuery, useWindowEvent } from '@mantine/hooks';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconExternalLink,
  IconFileTypePdf,
  IconLink,
  IconX,
} from '@tabler/icons-react';
import type { MediaFileRecord } from '@lawless-intranet/types';
import { formatBytes, getFileKind, stepIndex } from '../format';
import { useMediaUi } from '../MediaUiProvider';

/** Dark glass surfaces over the dimmed site (Discord-like). Host-theme independent on purpose. */
const ON_DARK = 'var(--mantine-color-white)';
const BACKDROP = 'color-mix(in srgb, var(--mantine-color-black) 85%, transparent)';
const GLASS = 'color-mix(in srgb, var(--mantine-color-black) 70%, transparent)';
const GLASS_BORDER = '1px solid color-mix(in srgb, var(--mantine-color-white) 12%, transparent)';

const glassStyle: CSSProperties = {
  backgroundColor: GLASS,
  border: GLASS_BORDER,
  backdropFilter: 'blur(6px)',
};

const toolStyle: CSSProperties = { color: ON_DARK };

/** iPhone notch / home indicator (installed app, viewport-fit=cover). */
const SAFE_TOP = 'env(safe-area-inset-top, 0px)';
const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';
/** Horizontal travel that turns a touch into a swipe to the previous / next file. */
const SWIPE_MIN_PX = 50;

const navButtonStyle: CSSProperties = {
  ...glassStyle,
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  color: ON_DARK,
};

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label} withinPortal zIndex={1000}>
      <ActionIcon variant="subtle" size="lg" radius="md" aria-label={label} onClick={onClick} style={toolStyle}>
        {children}
      </ActionIcon>
    </Tooltip>
  );
}

type MediaViewerProps = {
  /** Files of the current folder; the viewer moves between them with ← →. */
  files: readonly MediaFileRecord[];
  /** Index of the displayed file, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onDownload: (fileId: string) => void;
  /** Copies the public share link; hidden when sharing is not available. */
  onCopyShareLink?: (file: MediaFileRecord) => void;
  /** Signed preview URLs expire: asks the host to refresh the folder. */
  onExpired: () => void;
  onClose: () => void;
};

/**
 * Full-screen viewer over the dimmed site (Discord-like): file centered, tools
 * top right, ← → between the folder's files. No custom right-click menu here.
 */
export function MediaViewer({
  files,
  index,
  onIndexChange,
  onDownload,
  onCopyShareLink,
  onExpired,
  onClose,
}: MediaViewerProps) {
  const { formatDate } = useMediaUi();
  const file = index !== null ? files[index] : undefined;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [retriedId, setRetriedId] = useState<string | null>(null);
  const touch = useMediaQuery('(hover: none)') ?? false;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const step = (delta: number) => {
    if (index === null) return;
    const next = stepIndex(index, delta, files.length);
    if (next !== null) onIndexChange(next);
  };

  useWindowEvent('keydown', (event) => {
    if (!file) return;
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
  });

  const kind = file ? getFileKind(file.mimeType) : 'other';
  const hasPrevious = index !== null && stepIndex(index, -1, files.length) !== null;
  const hasNext = index !== null && stepIndex(index, 1, files.length) !== null;
  const imageLoading = kind === 'image' && file?.previewUrl != null && loadedUrl !== file.previewUrl;

  return (
    <Modal
      opened={file !== undefined}
      onClose={onClose}
      fullScreen
      withCloseButton={false}
      withOverlay={false}
      padding={0}
      transitionProps={{ transition: 'fade', duration: 150 }}
      // Explicit transparent surfaces: host themes paint modal content and body (e.g. parchment).
      styles={{
        content: { backgroundColor: BACKDROP, borderRadius: 0 },
        body: { backgroundColor: 'transparent', padding: 0, height: '100%', position: 'relative' },
      }}
      aria-label={file?.name}
    >
      {file ? (
        // Clicking the backdrop (outside the file and the tools) closes, like Discord.
        <Box
          h="100%"
          p={{ base: 'md', sm: 72 }}
          pt={{ base: `calc(72px + ${SAFE_TOP})`, sm: 80 }}
          pb={{ base: `calc(72px + ${SAFE_BOTTOM})`, sm: 72 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          // Touch: swipe left / right between the folder's files.
          onTouchStart={(event) => {
            const touchPoint = event.touches[0];
            swipeStart.current = event.touches.length === 1 && touchPoint ? { x: touchPoint.clientX, y: touchPoint.clientY } : null;
          }}
          onTouchEnd={(event) => {
            const start = swipeStart.current;
            const end = event.changedTouches[0];
            swipeStart.current = null;
            if (!start || !end) return;
            const dx = end.clientX - start.x;
            const dy = end.clientY - start.y;
            if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
          }}
        >
          {/* File name and details: top left, or at the bottom on phones (the tools take the top). */}
          <Box
            pos="absolute"
            top={{ base: 'auto', sm: 16 }}
            bottom={{ base: `calc(16px + ${SAFE_BOTTOM})`, sm: 'auto' }}
            left={20}
            right={{ base: 20, sm: 'auto' }}
            maw={{ base: 'none', sm: '45%' }}
            style={{ pointerEvents: 'none' }}
          >
            <Text c={ON_DARK} fw={600} truncate="end">
              {file.name}
            </Text>
            <Text c={ON_DARK} size="xs" opacity={0.65}>
              {formatBytes(file.size)} · {formatDate(file.createdAt)}
              {files.length > 1 && index !== null ? ` · ${index + 1} / ${files.length}` : ''}
            </Text>
          </Box>

          {/* Tools, top right: grouped glass pill + separate round close button. */}
          <Group pos="absolute" top={`calc(14px + ${SAFE_TOP})`} right={16} gap="xs" wrap="nowrap">
            <Group gap={2} p={4} wrap="nowrap" style={{ ...glassStyle, borderRadius: 'var(--mantine-radius-lg)' }}>
              {file.previewUrl ? (
                <Tool label="Ouvrir dans un nouvel onglet" onClick={() => window.open(file.previewUrl ?? '', '_blank', 'noopener')}>
                  <IconExternalLink size={20} />
                </Tool>
              ) : null}
              <Tool label="Télécharger" onClick={() => onDownload(file.id)}>
                <IconDownload size={20} />
              </Tool>
              {onCopyShareLink ? (
                <Tool label="Copier le lien de partage" onClick={() => onCopyShareLink(file)}>
                  <IconLink size={20} />
                </Tool>
              ) : null}
            </Group>
            <Tooltip label="Fermer (Échap)" withinPortal zIndex={1000}>
              <ActionIcon size={44} radius="xl" aria-label="Fermer" onClick={onClose} style={{ ...glassStyle, color: ON_DARK }}>
                <IconX size={22} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {!file.previewUrl ? (
            <Text c={ON_DARK}>Aperçu indisponible.</Text>
          ) : kind === 'pdf' && touch ? (
            // iOS shows only the first page of a PDF in a frame: the native viewer does better.
            <Stack align="center" gap="md">
              <IconFileTypePdf size={72} stroke={1.25} color={ON_DARK} />
              <Button
                size="md"
                radius="xl"
                leftSection={<IconExternalLink size={18} />}
                onClick={() => window.open(file.previewUrl ?? '', '_blank', 'noopener')}
              >
                Ouvrir le PDF
              </Button>
            </Stack>
          ) : kind === 'pdf' ? (
            <iframe
              key={file.id}
              src={file.previewUrl}
              title={file.name}
              style={{
                width: 'min(1100px, 100%)',
                height: '100%',
                border: 0,
                borderRadius: 'var(--mantine-radius-md)',
                boxShadow: 'var(--mantine-shadow-xl)',
              }}
            />
          ) : (
            <>
              {imageLoading ? (
                <Center pos="absolute" inset={0} style={{ pointerEvents: 'none' }}>
                  <Loader color={ON_DARK} />
                </Center>
              ) : null}
              <Image
                key={file.id}
                src={file.previewUrl}
                alt={file.name}
                fit="contain"
                maw="100%"
                mah="100%"
                w="auto"
                h="auto"
                radius="sm"
                style={{ opacity: imageLoading ? 0 : 1, boxShadow: 'var(--mantine-shadow-xl)' }}
                onLoad={() => setLoadedUrl(file.previewUrl)}
                onError={() => {
                  // Expired signed URL: refresh the folder once per file.
                  if (retriedId === file.id) return;
                  setRetriedId(file.id);
                  onExpired();
                }}
              />
            </>
          )}

          {hasPrevious ? (
            <ActionIcon size={48} radius="xl" aria-label="Fichier précédent" onClick={() => step(-1)} style={{ ...navButtonStyle, left: 16 }}>
              <IconChevronLeft size={28} />
            </ActionIcon>
          ) : null}
          {hasNext ? (
            <ActionIcon size={48} radius="xl" aria-label="Fichier suivant" onClick={() => step(1)} style={{ ...navButtonStyle, right: 16 }}>
              <IconChevronRight size={28} />
            </ActionIcon>
          ) : null}
        </Box>
      ) : null}
    </Modal>
  );
}
