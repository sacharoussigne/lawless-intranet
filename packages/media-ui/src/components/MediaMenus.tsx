'use client';

import { Menu } from '@mantine/core';
import {
  IconArrowsMove,
  IconDownload,
  IconEye,
  IconFolderOpen,
  IconFolderPlus,
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
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
};

function CommonItems({ onRename, onMove, onDelete }: ItemMenuActions) {
  return (
    <>
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

export function FileMenuItems({
  onPreview,
  onDownload,
  ...actions
}: ItemMenuActions & { onPreview: () => void; onDownload: () => void }) {
  return (
    <>
      <Menu.Item leftSection={<IconEye size={16} />} onClick={onPreview}>
        Aperçu
      </Menu.Item>
      <Menu.Item leftSection={<IconDownload size={16} />} onClick={onDownload}>
        Télécharger
      </Menu.Item>
      <Menu.Divider />
      <CommonItems {...actions} />
    </>
  );
}
