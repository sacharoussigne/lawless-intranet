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
 * A drop is useful when at least one item changes folder and no dragged folder
 * would go into itself. Deeper cycles (into a descendant) cannot be targeted
 * from the view and are refused by the service anyway.
 */
export function canDrop(items: readonly DragItem[], destination: string | null): boolean {
  if (items.length === 0) return false;
  if (items.some((item) => item.kind === 'folder' && item.id === destination)) return false;
  return items.some((item) => item.parentId !== destination);
}
