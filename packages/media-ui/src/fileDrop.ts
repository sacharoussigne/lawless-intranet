/** Files dragged from the computer: drop targets and payload detection. */
import { dropId, parseDropId } from './dnd';

/** Marks folders (cards, rows, breadcrumb) that accept dropped files. */
export const FILE_DROP_FOLDER_ATTRIBUTE = 'data-media-drop-folder';

export function fileDropFolderProps(folderId: string | null): Record<string, string> {
  return { [FILE_DROP_FOLDER_ATTRIBUTE]: dropId(folderId) };
}

/** True for a drag of files from the OS (not links, images or text from the page). */
export function isFileDrag(types: ArrayLike<string> | null | undefined): boolean {
  return types ? Array.from(types).includes('Files') : false;
}

type ClosestTarget = { closest: (selector: string) => { getAttribute: (name: string) => string | null } | null };

function hasClosest(target: unknown): target is ClosestTarget {
  return typeof target === 'object' && target !== null && typeof (target as ClosestTarget).closest === 'function';
}

/** Folder under the pointer (null = root); undefined when the drop is not over a folder target. */
export function fileDropFolder(target: unknown): string | null | undefined {
  if (!hasClosest(target)) return undefined;
  const value = target.closest(`[${FILE_DROP_FOLDER_ATTRIBUTE}]`)?.getAttribute(FILE_DROP_FOLDER_ATTRIBUTE);
  return value ? parseDropId(value) : undefined;
}
