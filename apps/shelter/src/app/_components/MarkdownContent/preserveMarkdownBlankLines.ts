/**
 * Keep visual blank lines that standard markdown would collapse.
 * One `\n\n` stays a paragraph break; each extra `\n` becomes an empty paragraph.
 */
export function preserveMarkdownBlankLines(source: string): string {
  return source.replace(/\n{2,}/g, (match) => {
    const newlineCount = match.length;
    if (newlineCount === 2) return '\n\n';
    const emptyParas = Array.from({ length: newlineCount - 2 }, () => '&nbsp;').join('\n\n');
    return `\n\n${emptyParas}\n\n`;
  });
}
