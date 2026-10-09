/** Browsers only accept PNG images in the clipboard. */
const CLIPBOARD_IMAGE_TYPE = 'image/png';

export function canCopyImages(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  );
}

/** Draws any browser-decodable image (JPEG, WebP, GIF first frame, SVG…) into a PNG. */
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === CLIPBOARD_IMAGE_TYPE) return blob;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Conversion de l’image impossible');
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (png) => (png ? resolve(png) : reject(new Error('Conversion de l’image impossible'))),
        CLIPBOARD_IMAGE_TYPE,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function fetchPng(getUrl: () => Promise<string>): Promise<Blob> {
  // no-store: the cached copy of the thumbnail was fetched without CORS and would be refused.
  const response = await fetch(await getUrl(), { mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error('Image introuvable ou lien expiré');
  return toPng(await response.blob());
}

/**
 * Copies an image into the clipboard. Must be called right in the click handler:
 * the ClipboardItem takes a promise, so the write keeps the user activation while
 * the image downloads (required by Safari, fine for Chrome and Firefox).
 */
export async function copyImageToClipboard(getUrl: () => Promise<string>): Promise<void> {
  if (!canCopyImages()) {
    throw new Error('Ce navigateur ne permet pas de copier une image');
  }
  await navigator.clipboard.write([new ClipboardItem({ [CLIPBOARD_IMAGE_TYPE]: fetchPng(getUrl) })]);
}
