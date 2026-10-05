export type FolderNode = { id: string; parentId: string | null };

/**
 * True when `candidateId` is `folderId` itself or one of its descendants.
 * Used to forbid moving a folder into its own subtree.
 */
export function isSameOrDescendant(
  folders: readonly FolderNode[],
  folderId: string,
  candidateId: string,
): boolean {
  const parentById = new Map(folders.map((folder) => [folder.id, folder.parentId]));
  let current: string | null = candidateId;
  const visited = new Set<string>();
  while (current) {
    if (current === folderId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentById.get(current) ?? null;
  }
  return false;
}

/** All folder ids of the subtree rooted at `rootId` (root included). */
export function collectSubtreeIds(folders: readonly FolderNode[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const siblings = childrenByParent.get(folder.parentId) ?? [];
    siblings.push(folder.id);
    childrenByParent.set(folder.parentId, siblings);
  }

  const result: string[] = [];
  const stack = [rootId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

/** Ancestors from the root to `folderId` (included). */
export function buildBreadcrumb<T extends FolderNode>(folders: readonly T[], folderId: string): T[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: T[] = [];
  const visited = new Set<string>();
  let current = byId.get(folderId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
