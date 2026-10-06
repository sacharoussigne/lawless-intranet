'use client';

import { useState, type CSSProperties } from 'react';
import { ActionIcon, Box, Button, Center, Group, Image, Loader, Modal, Text } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileTypePdf,
  IconPhoto,
  IconX,
} from '@tabler/icons-react';
import type { MediaFileRecord } from '@lawless-intranet/types';
import { formatBytes, getFileKind, stepIndex } from '../format';
import { useMediaUi } from '../MediaUiProvider';

const BAR_HEIGHT = 64;
const ON_DARK = 'var(--mantine-color-white)';
const navButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  color: ON_DARK,
  backgroundColor: 'color-mix(in srgb, var(--mantine-color-black) 55%, transparent)',
};

type MediaViewerProps = {
  /** Files of the current folder; the viewer moves between them with ← →. */
  files: readonly MediaFileRecord[];
  /** Index of the displayed file, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onDownload: (fileId: string) => void;
  /** Signed preview URLs expire: asks the host to refresh the folder. */
  onExpired: () => void;
  onClose: () => void;
};

/** Full-screen viewer over the site (Drive-like lightbox). No custom right-click menu here. */
export function MediaViewer({ files, index, onIndexChange, onDownload, onExpired, onClose }: MediaViewerProps) {
  const { formatDate } = useMediaUi();
  const file = index !== null ? files[index] : undefined;
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [retriedId, setRetriedId] = useState<string | null>(null);

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
  const TypeIcon = kind === 'pdf' ? IconFileTypePdf : IconPhoto;
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
      styles={{
        content: { backgroundColor: 'color-mix(in srgb, var(--mantine-color-black) 88%, transparent)' },
        body: { height: '100%', display: 'flex', flexDirection: 'column' },
      }}
      aria-label={file?.name}
    >
      {file ? (
        <>
          <Group h={BAR_HEIGHT} px="md" justify="space-between" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <TypeIcon size={22} color={ON_DARK} style={{ flexShrink: 0 }} />
              <Box style={{ minWidth: 0 }}>
                <Text c={ON_DARK} fw={500} truncate="end">
                  {file.name}
                </Text>
                <Text c={ON_DARK} size="xs" opacity={0.7}>
                  {formatBytes(file.size)} · importé le {formatDate(file.createdAt)}
                  {files.length > 1 && index !== null ? ` · ${index + 1} / ${files.length}` : ''}
                </Text>
              </Box>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Button leftSection={<IconDownload size={16} />} onClick={() => onDownload(file.id)}>
                Télécharger
              </Button>
              <ActionIcon variant="subtle" size="lg" radius="xl" aria-label="Fermer" onClick={onClose} style={{ color: ON_DARK }}>
                <IconX size={22} />
              </ActionIcon>
            </Group>
          </Group>

          {/* Clicking the dark background (outside the file) closes the viewer, like Drive. */}
          <Box
            pos="relative"
            px={72}
            pb="md"
            style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            {!file.previewUrl ? (
              <Text c={ON_DARK}>Aperçu indisponible.</Text>
            ) : kind === 'pdf' ? (
              <iframe
                key={file.id}
                src={file.previewUrl}
                title={file.name}
                style={{ width: 'min(1100px, 100%)', height: '100%', border: 0, borderRadius: 'var(--mantine-radius-sm)' }}
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
                  style={{ opacity: imageLoading ? 0 : 1 }}
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
              <ActionIcon size={48} radius="xl" aria-label="Fichier précédent" onClick={() => step(-1)} style={{ ...navButtonStyle, left: 12 }}>
                <IconChevronLeft size={28} />
              </ActionIcon>
            ) : null}
            {hasNext ? (
              <ActionIcon size={48} radius="xl" aria-label="Fichier suivant" onClick={() => step(1)} style={{ ...navButtonStyle, right: 12 }}>
                <IconChevronRight size={28} />
              </ActionIcon>
            ) : null}
          </Box>
        </>
      ) : null}
    </Modal>
  );
}
