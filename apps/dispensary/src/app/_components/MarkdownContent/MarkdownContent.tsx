'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import classes from './MarkdownContent.module.scss';

type MarkdownContentProps = {
  source: string;
  className?: string;
};

function MarkdownContentInner({ source, className }: MarkdownContentProps) {
  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownContent = memo(MarkdownContentInner);
