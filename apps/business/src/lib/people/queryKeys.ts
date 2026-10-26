export const peopleKeys = {
  all: (slug: string) => ['people', slug] as const,
  list: (slug: string) => [...peopleKeys.all(slug), 'list'] as const,
  staffHistory: (slug: string, discordUserId: string) =>
    [...peopleKeys.all(slug), 'staffHistory', discordUserId] as const,
};
