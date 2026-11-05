export const lettersKeys = {
  all: (slug: string) => ['letters', slug] as const,
  box: (slug: string, boxId: string) => [...lettersKeys.all(slug), 'box', boxId] as const,
  correspondents: (slug: string, boxId: string) => [...lettersKeys.box(slug, boxId), 'correspondents'] as const,
  conversation: (
    slug: string,
    boxId: string,
    correspondentId: string,
    filters: { search: string; includeArchived: boolean },
  ) => [...lettersKeys.box(slug, boxId), 'conversation', correspondentId, filters] as const,
  search: (slug: string, boxId: string, query: string, includeArchived: boolean) =>
    [...lettersKeys.box(slug, boxId), 'search', query, includeArchived] as const,
  members: (slug: string, boxId: string) => [...lettersKeys.box(slug, boxId), 'members'] as const,
  admin: (slug: string) => [...lettersKeys.all(slug), 'admin'] as const,
};
