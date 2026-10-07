/** Drive-like multiple selection (pure logic, keyed by `folder:<id>` / `file:<id>`). */

export type ItemKind = 'folder' | 'file';

export function itemKey(kind: ItemKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseItemKey(key: string): { kind: ItemKind; id: string } {
  const index = key.indexOf(':');
  return { kind: key.slice(0, index) as ItemKind, id: key.slice(index + 1) };
}

export type Selection = {
  keys: ReadonlySet<string>;
  /** Start of Shift+click ranges. */
  anchor: string | null;
};

export const EMPTY_SELECTION: Selection = { keys: new Set(), anchor: null };

export function selectOnly(key: string): Selection {
  return { keys: new Set([key]), anchor: key };
}

/**
 * Click with modifiers, `order` being the display order (folders then files):
 * plain click selects only the item, Ctrl/Cmd toggles it, Shift selects the
 * range from the anchor (added to the selection with Ctrl+Shift).
 */
export function applyClick(
  selection: Selection,
  key: string,
  modifiers: { toggle: boolean; range: boolean },
  order: readonly string[],
): Selection {
  if (modifiers.range && selection.anchor) {
    const from = order.indexOf(selection.anchor);
    const to = order.indexOf(key);
    if (from >= 0 && to >= 0) {
      const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      const keys = modifiers.toggle ? new Set([...selection.keys, ...range]) : new Set(range);
      return { keys, anchor: selection.anchor };
    }
  }
  if (modifiers.toggle) {
    const keys = new Set(selection.keys);
    if (keys.has(key)) keys.delete(key);
    else keys.add(key);
    return { keys, anchor: key };
  }
  return selectOnly(key);
}

/** Keeps only keys still displayed (items deleted or moved away by someone else). */
export function pruneSelection(selection: Selection, order: readonly string[]): Selection {
  const visible = new Set(order);
  if ([...selection.keys].every((key) => visible.has(key))) return selection;
  const keys = new Set([...selection.keys].filter((key) => visible.has(key)));
  return { keys, anchor: selection.anchor && visible.has(selection.anchor) ? selection.anchor : null };
}

/** Selected ids grouped for the batch API, in display order. */
export function splitSelection(keys: Iterable<string>): { folderIds: string[]; fileIds: string[] } {
  const folderIds: string[] = [];
  const fileIds: string[] = [];
  for (const key of keys) {
    const { kind, id } = parseItemKey(key);
    if (kind === 'folder') folderIds.push(id);
    else fileIds.push(id);
  }
  return { folderIds, fileIds };
}

export type Rect = { left: number; top: number; right: number; bottom: number };

export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
