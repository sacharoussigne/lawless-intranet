'use client';

import { Group, Menu, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { TemplateSegment } from '@lawless-intranet/mail-template-engine';
import { createDefaultSegment } from './segmentUtils';

interface SegmentToolbarProps {
  onAdd: (segment: TemplateSegment) => void;
}

export function SegmentToolbar({ onAdd }: SegmentToolbarProps) {
  const add = (kind: TemplateSegment['kind']) => {
    onAdd(createDefaultSegment(kind));
  };

  return (
    <Group>
      <Menu shadow="md" width={220}>
        <Menu.Target>
          <Button variant="light" color="sage" leftSection={<IconPlus size={16} />}>
            Ajouter un bloc
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => add('text')}>Texte</Menu.Item>
          <Menu.Item onClick={() => add('input')}>Champ formulaire</Menu.Item>
          <Menu.Item onClick={() => add('category')}>Catégorie</Menu.Item>
          <Menu.Item onClick={() => add('conditional')}>Conditionnel</Menu.Item>
          <Menu.Item onClick={() => add('js')}>JavaScript</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
