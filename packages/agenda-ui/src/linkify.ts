export type LinkifiedPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

/** Drops what usually ends a sentence rather than the URL ("see https://x.com/a." / "(https://x.com)"). */
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = url.replace(TRAILING_PUNCTUATION, '');
    if (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) {
      url = url.slice(0, -1);
    }
    if (url === before) return url;
  }
}

/** Splits a text into plain parts and http(s) links (www. ones get https://); no other scheme is linked. */
export function splitLinks(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const value = trimUrl(match[0]);
    const start = match.index ?? 0;
    if (!value.replace(/^(?:https?:\/\/|www\.)/i, '')) continue;
    if (start > cursor) parts.push({ type: 'text', value: text.slice(cursor, start) });
    const href = /^www\./i.test(value) ? `https://${value}` : value;
    parts.push({ type: 'link', value, href });
    cursor = start + value.length;
  }
  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) });
  return parts;
}
