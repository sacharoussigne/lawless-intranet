'use client';

import { useCallback, useRef, type KeyboardEvent } from 'react';
import { Textarea, type TextareaProps } from '@mantine/core';
import { toggleMarkdownWrap } from './toggleMarkdownWrap';

type MarkdownTextareaProps = Omit<TextareaProps, 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

export function MarkdownTextarea({
  value,
  onChange,
  onKeyDown,
  rows = 5,
  resize = 'vertical',
  ...rest
}: MarkdownTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyToggle = useCallback(
    (marker: string) => {
      const el = ref.current;
      if (!el) return;
      const result = toggleMarkdownWrap(
        value,
        el.selectionStart,
        el.selectionEnd,
        marker,
      );
      onChange(result.value);
      requestAnimationFrame(() => {
        const node = ref.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    },
    [onChange, value],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        applyToggle('**');
        return;
      }
      if (key === 'i') {
        event.preventDefault();
        applyToggle('*');
      }
    },
    [applyToggle, onKeyDown],
  );

  return (
    <Textarea
      {...rest}
      ref={ref}
      rows={rows}
      resize={resize}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onKeyDown={handleKeyDown}
    />
  );
}
