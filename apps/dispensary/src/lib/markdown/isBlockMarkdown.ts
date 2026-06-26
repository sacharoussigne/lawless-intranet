export function isBlockMarkdown(source: string): boolean {
  const trimmed = source.trim();
  if (!trimmed) return false;
  if (trimmed.includes('\n')) return true;
  if (/^#{1,6}\s/.test(trimmed)) return true;
  if (/^[-*+]\s/.test(trimmed)) return true;
  if (/^\d+\.\s/.test(trimmed)) return true;
  if (/^>/.test(trimmed)) return true;
  if (/```/.test(trimmed)) return true;
  if (/^\|/.test(trimmed)) return true;
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) return true;
  if (/!\[[^\]]*\]\([^)]+\)/.test(trimmed)) return true;
  return false;
}
