'use client';

import { useEffect, useRef, useState } from 'react';
import { fileDropFolder, isFileDrag } from '../fileDrop';

type FileDropState = {
  /** Files are dragged over the page. */
  active: boolean;
  /** Folder under the pointer (null = root); undefined = current folder. */
  hoveredFolder: string | null | undefined;
};

const IDLE: FileDropState = { active: false, hoveredFolder: undefined };

/**
 * Drive-like drop of files from the computer anywhere on the page. Listens on
 * `window`, so a file dropped outside the list no longer opens in the browser.
 * In-app moves (@dnd-kit, pointer events) never trigger it.
 */
export function useFileDrop({
  enabled,
  onDrop,
}: {
  enabled: boolean;
  onDrop: (files: File[], folderId: string | null | undefined) => void;
}): FileDropState {
  const [state, setState] = useState<FileDropState>(IDLE);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });

  useEffect(() => {
    if (!enabled) return;
    // dragenter / dragleave fire for every child crossed: count them to know when the drag leaves the window.
    let depth = 0;
    const reset = () => {
      depth = 0;
      setState(IDLE);
    };

    const handleEnter = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer?.types)) return;
      depth += 1;
      setState((current) => (current.active ? current : { ...current, active: true }));
    };
    const handleLeave = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer?.types)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setState(IDLE);
    };
    const handleOver = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer?.types)) return;
      event.preventDefault(); // allows the drop
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      const hoveredFolder = fileDropFolder(event.target);
      setState((current) =>
        current.active && current.hoveredFolder === hoveredFolder ? current : { active: true, hoveredFolder },
      );
    };
    const handleDrop = (event: DragEvent) => {
      if (!isFileDrag(event.dataTransfer?.types)) return;
      event.preventDefault(); // the browser would open the file
      reset();
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) onDropRef.current(files, fileDropFolder(event.target));
    };

    window.addEventListener('dragenter', handleEnter);
    window.addEventListener('dragleave', handleLeave);
    window.addEventListener('dragover', handleOver);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', handleEnter);
      window.removeEventListener('dragleave', handleLeave);
      window.removeEventListener('dragover', handleOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', reset);
    };
  }, [enabled]);

  return enabled ? state : IDLE;
}
