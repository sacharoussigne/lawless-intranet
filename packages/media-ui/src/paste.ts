/** Images pasted from the clipboard (screenshots, « Copier l'image » in Discord or a browser). */

/** Extension of a pasted file, from its MIME type. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/** Names browsers and OSes give to clipboard images: they say nothing about the content. */
const GENERIC_NAME = /^(image|blob|clipboard|unknown)?(\.[a-z0-9]+)?$/i;

type ClipboardLike = {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<{ kind: string; getAsFile: () => File | null }> | null;
};

/**
 * Files of a paste event, limited to the accepted types. A generic name (« image.png »)
 * becomes « Image collée <label>.png » so pasted images stay apart in the library.
 */
export function pastedFiles(data: ClipboardLike | null | undefined, allowedMimeTypes: readonly string[], label: string): File[] {
  if (!data) return [];
  let files = Array.from(data.files ?? []);
  // Some browsers only expose the image through the items.
  if (files.length === 0) {
    files = Array.from(data.items ?? []).flatMap((item) => {
      const file = item.kind === 'file' ? item.getAsFile() : null;
      return file ? [file] : [];
    });
  }

  const accepted = files.filter((file) => allowedMimeTypes.includes(file.type));
  return accepted.map((file, index) => {
    if (!GENERIC_NAME.test(file.name.trim())) return file;
    const suffix = accepted.length > 1 ? ` (${index + 1})` : '';
    const extension = EXTENSION_BY_TYPE[file.type] ?? file.type.split('/')[1] ?? 'bin';
    return new File([file], `Image collée ${label}${suffix}.${extension}`, { type: file.type });
  });
}
