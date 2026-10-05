export const mediaKeys = {
  all: (scopeKey: string) => ['media', scopeKey] as const,
  folder: (scopeKey: string, folderId: string | null) =>
    ['media', scopeKey, 'folder', folderId ?? 'root'] as const,
  tree: (scopeKey: string) => ['media', scopeKey, 'tree'] as const,
};
