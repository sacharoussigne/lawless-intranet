import type { MediaTreeFolderRecord } from '@lawless-intranet/types';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[unit]}`;
}

export type MediaFileKind = 'image' | 'pdf' | 'other';

export function getFileKind(mimeType: string): MediaFileKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'other';
}

export type TreeOption = { id: string; name: string; depth: number };

/**
 * Flattens the folder tree depth-first (sorted by name) for the move picker.
 * `excludeSubtreesOf` hides folders and their descendants (a folder cannot move into itself).
 */
export function flattenFolderTree(
  folders: readonly MediaTreeFolderRecord[],
  excludeSubtreesOf: readonly string[] = [],
): TreeOption[] {
  const childrenByParent = new Map<string | null, MediaTreeFolderRecord[]>();
  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.parentId) ?? [];
    siblings.push(folder);
    childrenByParent.set(folder.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  const excluded = new Set(excludeSubtreesOf);
  const result: TreeOption[] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of childrenByParent.get(parentId) ?? []) {
      if (excluded.has(folder.id) || visited.has(folder.id)) continue;
      visited.add(folder.id);
      result.push({ id: folder.id, name: folder.name, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

/** Keeps the extension when suggesting a rename selection. */
export function splitExtension(name: string): { base: string; extension: string } {
  const index = name.lastIndexOf('.');
  if (index <= 0) return { base: name, extension: '' };
  return { base: name.slice(0, index), extension: name.slice(index) };
}

/** Previous / next item of the viewer, without wrapping (like Drive). Null when out of range. */
export function stepIndex(index: number, delta: number, length: number): number | null {
  const next = index + delta;
  return next >= 0 && next < length ? next : null;
}

export type DeleteModalItem = { name: string; isFolder: boolean };

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

export function describeDeletion(items: readonly DeleteModalItem[]): string {
  const [first] = items;
  if (items.length === 1 && first) {
    return first.isFolder
      ? `Supprimer le dossier « ${first.name} » et tout son contenu (sous-dossiers et fichiers) ?`
      : `Supprimer le fichier « ${first.name} » ?`;
  }
  const folders = items.filter((item) => item.isFolder).length;
  const files = items.length - folders;
  const parts = [
    folders > 0
      ? `${plural(folders, 'dossier', 'dossiers')} (avec tout ${folders > 1 ? 'leur' : 'son'} contenu)`
      : null,
    files > 0 ? plural(files, 'fichier', 'fichiers') : null,
  ].filter(Boolean);
  return `Supprimer ${parts.join(' et ')} ?`;
}
