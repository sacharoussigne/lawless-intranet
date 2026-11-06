'use client';

import { type RefObject, useLayoutEffect } from 'react';

/**
 * Writes the document offset of the element in `--letters-top`, so its CSS height can end exactly at
 * the bottom of the viewport: only its panes scroll, never the page. Measured again when the window
 * resizes and when `watch` changes size (a toolbar that wraps, a banner above).
 */
export function useFillViewport(ref: RefObject<HTMLElement | null>, watch: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const top = element.getBoundingClientRect().top + window.scrollY;
      element.style.setProperty('--letters-top', `${Math.round(top)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    if (watch.current) observer.observe(watch.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [ref, watch]);
}
