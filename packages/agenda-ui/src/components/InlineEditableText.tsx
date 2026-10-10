'use client';

import type { MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader } from '@mantine/core';
import { stopDragProps } from './agendaDnd';
import classes from '../agenda.module.scss';

interface InlineEditableTextProps {
  value: string;
  canEdit: boolean;
  onSave: (value: string) => void | Promise<void>;
  textClassName?: string;
  inputClassName?: string;
  onEditingChange?: (editing: boolean) => void;
  /** Shows a spinner next to the text while the server confirms a change. */
  pending?: boolean;
  /** Touch screens (no double-click): a single tap edits. False to keep the tap for the parent (e.g. selecting a tab). */
  editOnTap?: boolean;
}

export function InlineEditableText({
  value,
  canEdit,
  onSave,
  textClassName,
  inputClassName,
  onEditingChange,
  pending = false,
  editOnTap = true,
}: InlineEditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommit = useRef(false);

  const setEditingState = useCallback(
    (next: boolean) => {
      setEditing(next);
      onEditingChange?.(next);
    },
    [onEditingChange],
  );

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [editing]);

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    setEditingState(false);
    if (!trimmed || trimmed === value) {
      setDraft(value);
      return;
    }
    await onSave(trimmed);
  }, [draft, value, onSave, setEditingState]);

  const cancel = () => {
    setEditingState(false);
    setDraft(value);
  };

  const startEditing = (event: MouseEvent) => {
    event.stopPropagation();
    if (!canEdit) return;
    setDraft(value);
    setEditingState(true);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className={inputClassName ?? classes.inlineEditableInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        {...stopDragProps}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => {
          if (skipBlurCommit.current) {
            skipBlurCommit.current = false;
            return;
          }
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            skipBlurCommit.current = true;
            void commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            skipBlurCommit.current = true;
            cancel();
          }
        }}
      />
    );
  }

  return (
    <>
      <span
        className={textClassName}
        onDoubleClick={startEditing}
        onClick={(event) => {
          if (editOnTap && canEdit && window.matchMedia('(hover: none)').matches) startEditing(event);
        }}
      >
        {value}
      </span>
      {pending && <Loader size={12} aria-label="Enregistrement en cours" />}
    </>
  );
}
