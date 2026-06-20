'use client';

import { TemplateEditorWithModes } from './TemplateEditorWithModes';

interface TemplateEditorLayoutProps {
  content: string;
  onContentChange: (value: string) => void;
}

export function TemplateEditorLayout({
  content,
  onContentChange,
}: TemplateEditorLayoutProps) {
  return (
    <TemplateEditorWithModes
      value={content}
      onChange={onContentChange}
      placeholder="Contenu du modèle de courrier"
    />
  );
}
