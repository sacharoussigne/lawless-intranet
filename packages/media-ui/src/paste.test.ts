import { describe, expect, it } from 'vitest';
import { pastedFiles } from './paste';

const ALLOWED = ['image/png', 'image/jpeg', 'application/pdf'];
const file = (name: string, type: string) => new File(['x'], name, { type });

describe('pastedFiles', () => {
  it('keeps the accepted types only', () => {
    const files = pastedFiles({ files: [file('a.png', 'image/png'), file('a.txt', 'text/plain')] }, ALLOWED, '1 nov.');
    expect(files.map((f) => f.name)).toEqual(['a.png']);
  });

  it('renames generic clipboard names', () => {
    for (const name of ['image.png', '', 'blob']) {
      const [pasted] = pastedFiles({ files: [file(name, 'image/png')] }, ALLOWED, '2 nov. 1890 à 14:05');
      expect(pasted?.name).toBe('Image collée 2 nov. 1890 à 14:05.png');
      expect(pasted?.type).toBe('image/png');
    }
  });

  it('numbers several generic images and keeps real names', () => {
    const files = pastedFiles(
      { files: [file('image.png', 'image/png'), file('photo.jpg', 'image/jpeg'), file('image.png', 'image/png')] },
      ALLOWED,
      'x',
    );
    expect(files.map((f) => f.name)).toEqual(['Image collée x (1).png', 'photo.jpg', 'Image collée x (3).png']);
  });

  it('reads the items when there are no files, once', () => {
    const items = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => file('image.png', 'image/png') },
    ];
    expect(pastedFiles({ files: [], items }, ALLOWED, 'x')).toHaveLength(1);
    expect(pastedFiles({ files: [file('a.png', 'image/png')], items }, ALLOWED, 'x')).toHaveLength(1);
  });

  it('ignores an empty clipboard', () => {
    expect(pastedFiles(null, ALLOWED, 'x')).toEqual([]);
    expect(pastedFiles({ files: [], items: [] }, ALLOWED, 'x')).toEqual([]);
  });
});
