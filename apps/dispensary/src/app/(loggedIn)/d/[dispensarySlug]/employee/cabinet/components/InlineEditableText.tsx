'use client';

import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput } from '@mantine/core';

interface InlineEditableTextProps {
  value: string;
  canEdit: boolean;
  onSave: (value: string) => void;
  textClassName?: string;
  placeholder?: string;
}

export function InlineEditableText({
  value,
  canEdit,
  onSave,
  textClassName,
  placeholder,
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed || trimmed === value) {
      setDraft(value);
      return;
    }
    onSave(trimmed);
  }, [draft, value, onSave]);

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const startEditing = (event: MouseEvent) => {
    event.stopPropagation();
    if (!canEdit) return;
    setDraft(value);
    setEditing(true);
  };

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        size="sm"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => {
          if (skipBlurCommit.current) {
            skipBlurCommit.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            skipBlurCommit.current = true;
            commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            skipBlurCommit.current = true;
            cancel();
          }
        }}
        styles={{ input: { fontFamily: 'var(--disp-font-display)', fontWeight: 400 } }}
      />
    );
  }

  return (
    <span
      className={textClassName}
      onDoubleClick={startEditing}
      style={{ cursor: canEdit ? 'text' : undefined }}
      title={canEdit ? 'Double-cliquer pour renommer' : undefined}
    >
      {value || placeholder}
    </span>
  );
}
