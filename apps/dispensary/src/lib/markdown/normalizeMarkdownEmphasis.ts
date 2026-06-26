export function normalizeMarkdownEmphasis(source: string): string {
  const withBold = source.replace(/\*\*([\s\S]+?)\*\*/g, (match, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return match;
    return `**${trimmed}**`;
  });

  return withBold.replace(
    /(?<!\*)\*([\s\S]+?)\*(?!\*)/g,
    (match, content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return match;
      return `*${trimmed}*`;
    },
  );
}
