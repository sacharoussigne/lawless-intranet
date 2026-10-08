'use client';

import { useCallback, useRef, useState } from 'react';
import { Loader } from '@mantine/core';
import classes from '../agenda.module.scss';

interface InlineNoteInputProps {
  placeholder: string;
  /** Resolving to `false` keeps the typed value so it can be retried. */
  onSubmit: (value: string) => void | boolean | Promise<void | boolean>;
  disabled?: boolean;
  className?: string;
}

export function InlineNoteInput({
  placeholder,
  onSubmit,
  disabled,
  className,
}: InlineNoteInputProps) {
  const [active, setActive] = useState(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommit = useRef(false);

  const activate = () => {
    if (disabled) return;
    setActive(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setActive(false);
      return;
    }
    // Keep the typed value visible until the server confirms.
    setSubmitting(true);
    try {
      const ok = await onSubmit(trimmed);
      if (ok !== false) {
        setActive(false);
        setValue('');
      }
    } finally {
      setSubmitting(false);
    }
  }, [value, onSubmit]);

  const cancel = () => {
    setActive(false);
    setValue('');
  };

  if (!active) {
    return (
      <button
        type="button"
        className={`${classes.inlineNotePlaceholder} ${className ?? ''}`}
        onClick={activate}
        disabled={disabled}
      >
        {placeholder}
      </button>
    );
  }

  if (submitting) {
    return (
      <div className={classes.inlineNoteSubmitting}>
        <input
          type="text"
          className={`${classes.inlineNoteInput} ${className ?? ''}`}
          value={value}
          readOnly
          aria-busy
        />
        <Loader size={12} aria-label="Enregistrement en cours" />
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className={`${classes.inlineNoteInput} ${className ?? ''}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
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
      placeholder={placeholder}
    />
  );
}
