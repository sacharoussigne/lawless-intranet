'use client';

import { TextInput } from '@mantine/core';

interface CategoryBlockEditorProps {
  title: string;
  onChange: (title: string) => void;
}

export function CategoryBlockEditor({ title, onChange }: CategoryBlockEditorProps) {
  return (
    <TextInput
      label="Titre de section (formulaire uniquement)"
      value={title}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder="Signes observés"
    />
  );
}
