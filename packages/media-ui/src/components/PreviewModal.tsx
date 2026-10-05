'use client';

import { Button, Center, Group, Image, Modal, Stack, Text } from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import type { MediaFileRecord } from '@lawless-intranet/types';
import { formatBytes, getFileKind } from '../format';
import { useMediaUi } from '../MediaUiProvider';

type PreviewModalProps = {
  file: MediaFileRecord | null;
  onDownload: (fileId: string) => void;
  onClose: () => void;
};

export function PreviewModal({ file, onDownload, onClose }: PreviewModalProps) {
  const { formatDate } = useMediaUi();
  const kind = file ? getFileKind(file.mimeType) : 'other';

  return (
    <Modal opened={file !== null} onClose={onClose} title={file?.name} size="xl" centered>
      {file ? (
        <Stack gap="md">
          {file.previewUrl && kind === 'image' ? (
            <Image src={file.previewUrl} alt={file.name} fit="contain" mah="70vh" radius="sm" />
          ) : null}
          {file.previewUrl && kind === 'pdf' ? (
            <iframe
              src={file.previewUrl}
              title={file.name}
              style={{ width: '100%', height: '70vh', border: 0 }}
            />
          ) : null}
          {!file.previewUrl ? (
            <Center py="xl">
              <Text c="dimmed">Aperçu indisponible.</Text>
            </Center>
          ) : null}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {formatBytes(file.size)} · importé le {formatDate(file.createdAt)}
            </Text>
            <Button leftSection={<IconDownload size={16} />} onClick={() => onDownload(file.id)}>
              Télécharger
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
