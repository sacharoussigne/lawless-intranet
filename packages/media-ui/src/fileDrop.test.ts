import { describe, expect, it } from 'vitest';
import { FILE_DROP_FOLDER_ATTRIBUTE, fileDropFolder, fileDropFolderProps, isFileDrag } from './fileDrop';

function fakeTarget(attribute: string | null) {
  return {
    closest: (selector: string) =>
      selector === `[${FILE_DROP_FOLDER_ATTRIBUTE}]` && attribute !== null
        ? { getAttribute: () => attribute }
        : null,
  };
}

describe('isFileDrag', () => {
  it('detects files only', () => {
    expect(isFileDrag(['Files'])).toBe(true);
    expect(isFileDrag(['text/plain', 'Files'])).toBe(true);
    expect(isFileDrag(['text/uri-list'])).toBe(false);
    expect(isFileDrag(undefined)).toBe(false);
  });
});

describe('fileDropFolder', () => {
  it('reads the folder of the closest target', () => {
    expect(fileDropFolder(fakeTarget(fileDropFolderProps('abc')[FILE_DROP_FOLDER_ATTRIBUTE] ?? null))).toBe('abc');
    expect(fileDropFolder(fakeTarget(fileDropFolderProps(null)[FILE_DROP_FOLDER_ATTRIBUTE] ?? null))).toBeNull();
  });

  it('is undefined outside a folder target', () => {
    expect(fileDropFolder(fakeTarget(null))).toBeUndefined();
    expect(fileDropFolder(fakeTarget('something-else'))).toBeUndefined();
    expect(fileDropFolder(null)).toBeUndefined();
    expect(fileDropFolder({})).toBeUndefined(); // e.g. `window`, which has no `closest`
  });
});

