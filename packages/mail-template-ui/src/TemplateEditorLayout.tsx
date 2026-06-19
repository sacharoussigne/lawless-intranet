'use client';

import { Stack, Text, Paper, ScrollArea, Grid } from '@mantine/core';
import { TemplateEditor } from './TemplateEditor';
import { DetectedParameters } from './DetectedParameters';

interface TemplateEditorLayoutProps {
  content: string;
  onContentChange: (value: string) => void;
}

export function TemplateEditorLayout({
  content,
  onContentChange,
}: TemplateEditorLayoutProps) {
  return (
    <Grid gutter="xl">
      <Grid.Col span={6} style={{ minWidth: 0 }}>
        <Stack gap="md">
          <Text size="sm" fw={600}>
            Éditeur
          </Text>
          <Paper p="md" withBorder>
            <TemplateEditor
              placeholder="Contenu du modèle de courrier"
              value={content}
              onChange={onContentChange}
              hideParameters
              fixedHeight
            />
          </Paper>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6} style={{ minWidth: 0 }}>
        <Stack gap="md">
          <Text size="sm" fw={600}>
            Paramètres détectés
          </Text>
          <Paper p="md" withBorder>
            <ScrollArea h={500} scrollbars="y" type="auto">
              <DetectedParameters content={content} />
            </ScrollArea>
          </Paper>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
