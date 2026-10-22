'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { Slice } from '@tiptap/pm/model';
import type { SuggestionProps } from '@tiptap/suggestion';
import { Button, Group, Menu, Paper, Portal, Stack, Text as MantineText, UnstyledButton } from '@mantine/core';
import { IconAt } from '@tabler/icons-react';
import { editorDocToTemplate, templateToEditorDoc } from './convert';
import {
  createTemplateMention,
  templateSuggestionItems,
  type TemplateSuggestionItem,
  type TemplateSuggestionRenderer,
} from './mentionSuggestion';
import { TemplateTokenNode } from './nodes/TemplateTokenNode';
import { TemplateVariableNode } from './nodes/TemplateVariableNode';
import classes from './richText.module.scss';

type OpenSuggestion = Pick<
  SuggestionProps<TemplateSuggestionItem>,
  'items' | 'command' | 'clientRect'
>;

interface TemplateRichEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function SuggestionLabel({ item }: { item: TemplateSuggestionItem }) {
  return (
    <>
      <span>{item.label}</span>
      {item.description ? (
        <MantineText component="span" size="xs" c="dimmed" display="block" lh={1.3}>
          {item.description}
        </MantineText>
      ) : null}
    </>
  );
}

/** Letter text with variables, fields and conditions as pills; `@` inserts them. */
export function TemplateRichEditor({ value, onChange }: TemplateRichEditorProps) {
  const [suggestion, setSuggestion] = useState<OpenSuggestion | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // The suggestion plugin calls the latest handlers through this ref.
  const rendererRef = useRef<TemplateSuggestionRenderer | null>(null);
  const stateRef = useRef({ suggestion, activeIndex });
  stateRef.current = { suggestion, activeIndex };
  rendererRef.current = {
    onOpen: (props) => {
      setSuggestion(props);
      setActiveIndex(0);
    },
    onUpdate: (props) => {
      setSuggestion(props);
      setActiveIndex(0);
    },
    onExit: () => setSuggestion(null),
    onKeyDown: ({ event }) => {
      const current = stateRef.current.suggestion;
      if (!current || current.items.length === 0) return false;
      const count = current.items.length;
      if (event.key === 'ArrowDown') {
        setActiveIndex((index) => (index + 1) % count);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActiveIndex((index) => (index - 1 + count) % count);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = current.items[stateRef.current.activeIndex];
        if (item) current.command(item);
        return true;
      }
      if (event.key === 'Escape') {
        setSuggestion(null);
        return true;
      }
      return false;
    },
  };

  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      UndoRedo,
      Placeholder.configure({
        placeholder:
          'Écrivez le courrier… Tapez @ pour insérer une variable, un champ ou une condition.',
      }),
      TemplateVariableNode,
      TemplateTokenNode,
      createTemplateMention(() => rendererRef.current as TemplateSuggestionRenderer),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: templateToEditorDoc(value),
    immediatelyRender: false,
    editorProps: {
      // Plain text only: a pasted template becomes pills, copying gives the template back.
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (text === undefined || text === '') return false;
        const doc = view.state.schema.nodeFromJSON(templateToEditorDoc(text));
        view.dispatch(view.state.tr.replaceSelection(new Slice(doc.content, 1, 1)));
        return true;
      },
      clipboardTextSerializer: (slice) => {
        const nodes = slice.content.toJSON() as Parameters<typeof editorDocToTemplate>[0][];
        const isBlocks = nodes.some((node) => node.type === 'paragraph');
        return editorDocToTemplate({
          type: 'doc',
          content: isBlocks ? nodes : [{ type: 'paragraph', content: nodes }],
        });
      },
    },
    onUpdate: ({ editor: current }) => {
      const next = editorDocToTemplate(current.getJSON());
      if (next === lastEmittedRef.current) return;
      lastEmittedRef.current = next;
      onChangeRef.current(next);
    },
  });

  // A template changed from outside (inline mode, reset) reloads the editor without echo.
  useEffect(() => {
    if (!editor || value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(templateToEditorDoc(value), { emitUpdate: false });
  }, [editor, value]);

  const insertFromMenu = (item: TemplateSuggestionItem) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    item.run(editor, { from, to });
  };

  const menuItems = editor ? templateSuggestionItems(editor, '') : [];
  const rect = suggestion?.clientRect?.() ?? null;

  return (
    <Stack gap="xs">
      <Group justify="flex-end">
        <Menu shadow="md" width={300} position="bottom-end">
          <Menu.Target>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconAt size={14} />}
              disabled={!editor}
            >
              Insérer
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {(['Variables', 'Insérer'] as const).map((group) => (
              <div key={group}>
                <Menu.Label>{group}</Menu.Label>
                {menuItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <Menu.Item key={item.key} onClick={() => insertFromMenu(item)}>
                      <SuggestionLabel item={item} />
                    </Menu.Item>
                  ))}
              </div>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <EditorContent editor={editor} className={classes.editor} />

      {suggestion && rect ? (
        <Portal>
          <Paper
            className={classes.suggestions}
            shadow="md"
            withBorder
            style={{ top: rect.bottom + 4, left: rect.left }}
            // Keep the editor focused while clicking an item.
            onMouseDown={(event) => event.preventDefault()}
          >
            {suggestion.items.length === 0 ? (
              <MantineText size="sm" c="dimmed" px="sm" py={6}>
                Aucun résultat
              </MantineText>
            ) : (
              suggestion.items.map((item, index) => {
                const previous = suggestion.items[index - 1];
                return (
                  <div key={item.key}>
                    {previous?.group !== item.group ? (
                      <MantineText size="xs" c="dimmed" fw={600} px="sm" pt={6} pb={2}>
                        {item.group}
                      </MantineText>
                    ) : null}
                    <UnstyledButton
                      className={classes.suggestionItem}
                      data-active={index === activeIndex || undefined}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => suggestion.command(item)}
                    >
                      <SuggestionLabel item={item} />
                    </UnstyledButton>
                  </div>
                );
              })
            )}
          </Paper>
        </Portal>
      ) : null}
    </Stack>
  );
}
