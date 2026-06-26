'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { normalizeMarkdownEmphasis } from '@/lib/markdown/normalizeMarkdownEmphasis';
import classes from './MarkdownContent.module.scss';

type MarkdownContentProps = {
  source: string;
  className?: string;
  inline?: boolean;
};

function MarkdownContentInner({ source, className, inline = false }: MarkdownContentProps) {
  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = normalizeMarkdownEmphasis(trimmed);

  return (
    <div
      className={[inline ? classes.inline : classes.root, className].filter(Boolean).join(' ')}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownContent = memo(MarkdownContentInner);
