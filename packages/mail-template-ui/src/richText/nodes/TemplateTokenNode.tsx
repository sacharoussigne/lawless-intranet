'use client';

import { useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { Button, Group, Popover, Stack } from '@mantine/core';
import { IconCode, IconForms, IconGitBranch, IconHeading } from '@tabler/icons-react';
import { serializeSegment } from '@lawless-intranet/mail-template-engine';
import { InputBlockEditor } from '../../visual/InputBlockEditor';
import { ConditionalBlockEditor } from '../../visual/ConditionalBlockEditor';
import { CategoryBlockEditor } from '../../visual/CategoryBlockEditor';
import { JsBlockEditor } from '../../visual/JsBlockEditor';
import { TOKEN_NODE, collectCheckboxNames, tokenSummary, type TokenSegment } from '../convert';
import classes from '../richText.module.scss';

const ICONS = {
  input: IconForms,
  conditional: IconGitBranch,
  category: IconHeading,
  js: IconCode,
} as const;

function SegmentForm({
  segment,
  onChange,
  checkboxNames,
}: {
  segment: TokenSegment;
  onChange: (segment: TokenSegment) => void;
  checkboxNames: string[];
}) {
  switch (segment.kind) {
    case 'input':
      return (
        <InputBlockEditor
          input={segment.input}
          availableParentNames={checkboxNames.filter((name) => name !== segment.input.name)}
          onChange={(input) => onChange({ kind: 'input', input })}
        />
      );
    case 'conditional':
      return <ConditionalBlockEditor segment={segment} onChange={onChange} />;
    case 'category':
      return (
        <CategoryBlockEditor
          title={segment.title}
          onChange={(title) => onChange({ kind: 'category', title })}
        />
      );
    case 'js':
      return <JsBlockEditor code={segment.code} onChange={(code) => onChange({ kind: 'js', code })} />;
  }
}

function TokenPill({ node, editor, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const segment = node.attrs.segment as TokenSegment;
  const [opened, setOpened] = useState<boolean>(Boolean(node.attrs.isNew));
  const [draft, setDraft] = useState<TokenSegment>(segment);
  const Icon = ICONS[segment.kind];

  const open = () => {
    if (!editor.isEditable) return;
    setDraft(segment);
    setOpened(true);
  };

  const close = () => {
    setOpened(false);
    if (node.attrs.isNew) updateAttributes({ isNew: false });
  };

  const validate = () => {
    const changed = JSON.stringify(draft) !== JSON.stringify(segment);
    // An edited pill is written from its segment again; an untouched one keeps its source text.
    updateAttributes(changed ? { segment: draft, raw: null, isNew: false } : { isNew: false });
    setOpened(false);
    editor.commands.focus();
  };

  return (
    <NodeViewWrapper as="span">
      <Popover
        opened={opened}
        onChange={(next) => (next ? open() : close())}
        width={420}
        position="bottom-start"
        shadow="md"
        trapFocus
      >
        <Popover.Target>
          <span
            className={classes.tokenPill}
            onClick={open}
            title={serializeSegment(segment)}
            data-drag-handle
          >
            <Icon size={12} stroke={1.8} />
            {tokenSummary(segment)}
          </span>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="sm">
            <SegmentForm
              segment={draft}
              onChange={setDraft}
              checkboxNames={collectCheckboxNames(editor.getJSON())}
            />
            <Group justify="space-between">
              <Button variant="subtle" color="danger" size="xs" onClick={deleteNode}>
                Supprimer
              </Button>
              <Group gap="xs">
                <Button variant="subtle" size="xs" onClick={close}>
                  Annuler
                </Button>
                <Button size="xs" onClick={validate}>
                  Valider
                </Button>
              </Group>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </NodeViewWrapper>
  );
}

/** Form field, condition, section or JS block shown as a pill, edited in a popover. */
export const TemplateTokenNode = Node.create({
  name: TOKEN_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      segment: { default: null, rendered: false },
      /** Source text, written back while the pill is untouched. */
      raw: { default: null, rendered: false },
      /** Just inserted: opens its popover. */
      isNew: { default: false, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-template-token]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-template-token': '' })];
  },

  renderText({ node }) {
    return node.attrs.raw || serializeSegment(node.attrs.segment as TokenSegment);
  },

  addNodeView() {
    return ReactNodeViewRenderer(TokenPill, { as: 'span' });
  },
});
