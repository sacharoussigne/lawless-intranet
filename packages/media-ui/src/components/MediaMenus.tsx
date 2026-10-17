'use client';

import { Menu } from '@mantine/core';
import {
  IconArrowsMove,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconEye,
  IconFolderOpen,
  IconFolderPlus,
  IconInfoCircle,
  IconLink,
  IconLinkOff,
  IconPencil,
  IconTrash,
  IconUpload,
  IconWorldPlus,
} from '@tabler/icons-react';

/** Menu entries shared by the right-click menu, the ⋮ buttons and the breadcrumb menu. */

export type BackgroundMenuActions = {
  onCreateFolder: () => void;
  onCreateLink: () => void;
  onUpload: () => void;
  uploadDisabled?: boolean;
};

export function BackgroundMenuItems({ onCreateFolder, onCreateLink, onUpload, uploadDisabled }: BackgroundMenuActions) {
  return (
    <>
      <Menu.Item leftSection={<IconFolderPlus size={16} />} onClick={onCreateFolder}>
        Nouveau dossier
      </Menu.Item>
      {/* No storage needed: available even when uploads are not. */}
      <Menu.Item leftSection={<IconWorldPlus size={16} />} onClick={onCreateLink}>
        Nouveau lien
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item leftSection={<IconUpload size={16} />} onClick={onUpload} disabled={uploadDisabled}>
        Importer des fichiers
      </Menu.Item>
    </>
  );
}

export type ItemMenuActions = {
  onInfo: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
};

function CommonItems({
  onInfo,
  onRename,
  onMove,
  onDelete,
  renameLabel = 'Renommer',
}: ItemMenuActions & { renameLabel?: string }) {
  return (
    <>
      <Menu.Item leftSection={<IconInfoCircle size={16} />} onClick={onInfo}>
        Informations
      </Menu.Item>
      <Menu.Item leftSection={<IconPencil size={16} />} onClick={onRename}>
        {renameLabel}
      </Menu.Item>
      <Menu.Item leftSection={<IconArrowsMove size={16} />} onClick={onMove}>
        Déplacer
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="danger" leftSection={<IconTrash size={16} />} onClick={onDelete}>
        Supprimer
      </Menu.Item>
    </>
  );
}

export function FolderMenuItems({ onOpen, ...actions }: ItemMenuActions & { onOpen: () => void }) {
  return (
    <>
      <Menu.Item leftSection={<IconFolderOpen size={16} />} onClick={onOpen}>
        Ouvrir
      </Menu.Item>
      <Menu.Divider />
      <CommonItems {...actions} />
    </>
  );
}

/** `onRename` edits the name and the address. */
export function LinkMenuItems({
  onOpen,
  onCopyUrl,
  ...actions
}: ItemMenuActions & { onOpen: () => void; onCopyUrl: () => void }) {
  return (
    <>
      <Menu.Item leftSection={<IconExternalLink size={16} />} onClick={onOpen}>
        Ouvrir le lien
      </Menu.Item>
      <Menu.Item leftSection={<IconCopy size={16} />} onClick={onCopyUrl}>
        Copier l’adresse
      </Menu.Item>
      <Menu.Divider />
      <CommonItems {...actions} renameLabel="Modifier" />
    </>
  );
}

export type ShareMenuActions = {
  shared: boolean;
  onCopyLink: () => void;
  onRevokeLink: () => void;
};

export function FileMenuItems({
  onPreview,
  onDownload,
  onCopyImage,
  share,
  ...actions
}: ItemMenuActions & {
  onPreview: () => void;
  onDownload: () => void;
  /** Images only. */
  onCopyImage?: () => void;
  share?: ShareMenuActions;
}) {
  return (
    <>
      <Menu.Item leftSection={<IconEye size={16} />} onClick={onPreview}>
        Aperçu
      </Menu.Item>
      <Menu.Item leftSection={<IconDownload size={16} />} onClick={onDownload}>
        Télécharger
      </Menu.Item>
      {onCopyImage ? (
        <Menu.Item leftSection={<IconCopy size={16} />} onClick={onCopyImage}>
          Copier l’image
        </Menu.Item>
      ) : null}
      {share ? (
        <>
          <Menu.Divider />
          <Menu.Item leftSection={<IconLink size={16} />} onClick={share.onCopyLink}>
            Copier le lien de partage
          </Menu.Item>
          {share.shared ? (
            <Menu.Item leftSection={<IconLinkOff size={16} />} onClick={share.onRevokeLink}>
              Désactiver le lien
            </Menu.Item>
          ) : null}
        </>
      ) : null}
      <Menu.Divider />
      <CommonItems {...actions} />
    </>
  );
}

/** Right-click on an item of a multiple selection. */
export function SelectionMenuItems({
  count,
  onMove,
  onDelete,
}: {
  count: number;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Menu.Label>{count} éléments sélectionnés</Menu.Label>
      <Menu.Item leftSection={<IconArrowsMove size={16} />} onClick={onMove}>
        Déplacer
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item color="danger" leftSection={<IconTrash size={16} />} onClick={onDelete}>
        Supprimer
      </Menu.Item>
    </>
  );
}
