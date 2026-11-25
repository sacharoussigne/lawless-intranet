'use client';

import { useState, type MouseEvent } from 'react';
import { splitLinks } from '../linkify';
import classes from '../agenda.module.scss';

function isTouchScreen() {
  return typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
}

function isMac() {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Text whose URLs are links. On a computer they open with Cmd/Ctrl+click (or middle click), so a
 * plain click keeps dragging / double-click editing the row; on touch screens a tap opens them.
 * `openOnClick`: a plain click opens them too (read-only places).
 */
export function LinkifiedText({ text, openOnClick = false }: { text: string; openOnClick?: boolean }) {
  // Computed on hover, not during render: the server does not know the platform.
  const [hint, setHint] = useState<string | undefined>(undefined);
  const parts = splitLinks(text);
  if (!parts.some((part) => part.type === 'link')) return <>{text}</>;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (openOnClick || isTouchScreen() || event.metaKey || event.ctrlKey) {
      // Opens (default of the link) without editing / selecting the row.
      event.stopPropagation();
      return;
    }
    event.preventDefault();
  };

  return (
    <>
      {parts.map((part, index) =>
        part.type === 'link' ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.todoLink}
            title={hint}
            onMouseEnter={() => {
              if (!openOnClick && !hint) setHint(`${isMac() ? '⌘' : 'Ctrl'} + clic pour ouvrir le lien`);
            }}
            onClick={handleClick}
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
}
