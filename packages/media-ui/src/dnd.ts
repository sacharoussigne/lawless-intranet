/** Drag & drop ids and rules for moving items between folders. */

export type DragItem = {
  kind: 'folder' | 'file';
  id: string;
  /** Current folder of the item (null = root). */
  parentId: string | null;
};

const ROOT = 'root';

export function dragId(item: Pick<DragItem, 'kind' | 'id'>): string {
  return `drag:${item.kind}:${item.id}`;
}

export function dropId(folderId: string | null): string {
  return `drop:${folderId ?? ROOT}`;
}

/** Parses a drop id back to its folder (null = root); undefined when it is not a drop target. */
export function parseDropId(id: string): string | null | undefined {
  if (!id.startsWith('drop:')) return undefined;
  const value = id.slice('drop:'.length);
  return value === ROOT ? null : value;
}

/**
 * A drop is useful when it changes the folder and does not put a folder into itself.
 * Deeper cycles (into a descendant) cannot be targeted from the grid and are refused by the service.
 */
export function canDrop(item: DragItem, destination: string | null): boolean {
  if (destination === item.parentId) return false;
  if (item.kind === 'folder' && destination === item.id) return false;
  return true;
}
