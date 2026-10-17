'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Group, Modal, Stack, Text } from '@mantine/core';
import type { MediaFileRecord, MediaFolderRecord, MediaLinkRecord } from '@lawless-intranet/types';
import { describeFileType, formatBytes, getFileKind, wasModified } from '../format';
import { useMediaUserName } from '../hooks/useMediaQueries';
import { useMediaUi } from '../MediaUiProvider';

export type InfoTarget =
  | { kind: 'folder'; item: MediaFolderRecord }
  | { kind: 'link'; item: MediaLinkRecord }
  | { kind: 'file'; item: MediaFileRecord };

type InfoModalProps = {
  target: InfoTarget | null;
  /** Path of the folder holding the item (« Médiathèque / Affiches »). */
  location: string;
  onClose: () => void;
};

type Dimensions = { url: string; width: number; height: number };

/** Pixel size read from the already signed preview: nothing is stored. */
function useImageDimensions(url: string | null): Dimensions | null {
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);

  useEffect(() => {
    if (!url) return;
    const image = new Image();
    image.onload = () => setDimensions({ url, width: image.naturalWidth, height: image.naturalHeight });
    image.src = url;
    return () => {
      image.onload = null;
    };
  }, [url]);

  return dimensions && dimensions.url === url && dimensions.width > 0 ? dimensions : null;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group gap="md" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" w={130} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {children}
      </Text>
    </Group>
  );
}

const TYPE_BY_KIND = { folder: 'Dossier', link: 'Lien' } as const;

/** « Informations » of an item: only what the library already knows, missing rows are hidden. */
export function InfoModal({ target, location, onClose }: InfoModalProps) {
  const { formatDateTime } = useMediaUi();
  const file = target?.kind === 'file' ? target.item : null;
  const isImage = file !== null && getFileKind(file.mimeType) === 'image';
  const dimensions = useImageDimensions(isImage ? file.previewUrl : null);
  const link = target?.kind === 'link' ? target.item : null;
  const uploader = useMediaUserName(file?.uploadedById ?? link?.createdById ?? null);

  return (
    <Modal opened={target !== null} onClose={onClose} title="Informations" centered>
      {target ? (
        <Stack gap="sm">
          <InfoRow label="Nom">{target.item.name}</InfoRow>
          <InfoRow label="Type">
            {target.kind === 'file' ? describeFileType(target.item.mimeType) : TYPE_BY_KIND[target.kind]}
          </InfoRow>
          {link ? <InfoRow label="Adresse">{link.url}</InfoRow> : null}
          {file ? <InfoRow label="Taille">{formatBytes(file.size)}</InfoRow> : null}
          {dimensions ? (
            <InfoRow label="Dimensions">
              {dimensions.width} × {dimensions.height} px
            </InfoRow>
          ) : null}
          <InfoRow label="Emplacement">{location}</InfoRow>
          <InfoRow label={target.kind === 'folder' ? 'Créé le' : 'Ajouté le'}>
            {formatDateTime(target.item.createdAt)}
          </InfoRow>
          {wasModified(target.item.createdAt, target.item.updatedAt) ? (
            <InfoRow label="Modifié le">{formatDateTime(target.item.updatedAt)}</InfoRow>
          ) : null}
          {uploader.data ? <InfoRow label="Ajouté par">{uploader.data}</InfoRow> : null}
          {file?.shareToken ? <InfoRow label="Partage">Lien public actif</InfoRow> : null}
        </Stack>
      ) : null}
    </Modal>
  );
}
