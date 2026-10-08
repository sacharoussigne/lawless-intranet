'use client';

import { Menu } from '@mantine/core';
import {
  IconArrowsMove,
  IconDownload,
  IconEye,
  IconFolderOpen,
  IconFolderPlus,
  IconInfoCircle,
  IconLink,
  IconLinkOff,
  IconPencil,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';

/** Menu entries shared by the right-click menu, the ⋮ buttons and the breadcrumb menu. */

export type BackgroundMenuActions = {
  onCreateFolder: () => void;
  onUpload: () => void;
  uploadDisabled?: boolean;
};

export function BackgroundMenuItems({ onCreateFolder, onUpload, uploadDisabled }: BackgroundMenuActions) {
  return (
    <>
      <Menu.Item leftSection={<IconFolderPlus size={16} />} onClick={onCreateFolder}>
        Nouveau dossier
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

function CommonItems({ onInfo, onRename, onMove, onDelete }: ItemMenuActions) {
  return (
    <>
      <Menu.Item leftSection={<IconInfoCircle size={16} />} onClick={onInfo}>
        Informations
      </Menu.Item>
      <Menu.Item leftSection={<IconPencil size={16} />} onClick={onRename}>
        Renommer
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

export type ShareMenuActions = {
  shared: boolean;
  onCopyLink: () => void;
  onRevokeLink: () => void;
};

export function FileMenuItems({
  onPreview,
  onDownload,
  share,
  ...actions
}: ItemMenuActions & { onPreview: () => void; onDownload: () => void; share?: ShareMenuActions }) {
  return (
    <>
      <Menu.Item leftSection={<IconEye size={16} />} onClick={onPreview}>
        Aperçu
      </Menu.Item>
      <Menu.Item leftSection={<IconDownload size={16} />} onClick={onDownload}>
        Télécharger
      </Menu.Item>
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
