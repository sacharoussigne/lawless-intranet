import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion';
import { BUILTIN_VARIABLE_DESCRIPTIONS, createDefaultSegment } from '../visual/segmentUtils';
import { TOKEN_NODE, VARIABLE_NODE, collectInputs, type TokenSegment } from './convert';

export interface TemplateSuggestionItem {
  key: string;
  label: string;
  group: 'Variables' | 'Insérer';
  /** Shown under the label (what a variable holds). */
  description?: string;
  /** Extra words matched by the search (e.g. « if » for a condition). */
  keywords?: string;
  run: (editor: Editor, range: Range) => void;
}

/** Bridge to the React list rendered by the editor component. */
export interface TemplateSuggestionRenderer {
  onOpen: (props: SuggestionProps<TemplateSuggestionItem>) => void;
  onUpdate: (props: SuggestionProps<TemplateSuggestionItem>) => void;
  onExit: () => void;
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

function insertToken(segment: TokenSegment) {
  return (editor: Editor, range: Range) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent({ type: TOKEN_NODE, attrs: { segment, raw: null, isNew: true } })
      .run();
  };
}

export function insertVariable(name: string) {
  return (editor: Editor, range: Range) => {
    editor
      .chain()
      .focus()
      .deleteRange(range)
      .insertContent({ type: VARIABLE_NODE, attrs: { name } })
      .run();
  };
}

const INSERT_ITEMS: TemplateSuggestionItem[] = [
  {
    key: 'input',
    label: 'Champ de formulaire',
    group: 'Insérer',
    keywords: 'input champ formulaire',
    run: (editor, range) => insertToken(createDefaultSegment('input') as TokenSegment)(editor, range),
  },
  {
    key: 'if-empty',
    label: 'Condition : vide / rempli',
    group: 'Insérer',
    keywords: 'if si condition vide rempli',
    run: (editor, range) =>
      insertToken(createDefaultSegment('conditional') as TokenSegment)(editor, range),
  },
  {
    key: 'if-equals',
    label: 'Condition : égal à',
    group: 'Insérer',
    keywords: 'if si condition egal égal genre',
    run: insertToken({
      kind: 'conditional',
      var: 'gender',
      eq: 'female',
      then: 'Je soussignée',
      else: 'Je soussigné',
    }),
  },
  {
    key: 'category',
    label: 'Section',
    group: 'Insérer',
    keywords: 'categorie catégorie section titre',
    run: (editor, range) => insertToken(createDefaultSegment('category') as TokenSegment)(editor, range),
  },
  {
    key: 'js',
    label: 'Code JavaScript',
    group: 'Insérer',
    keywords: 'js javascript code',
    run: (editor, range) => insertToken(createDefaultSegment('js') as TokenSegment)(editor, range),
  },
];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Variable name → what it holds when the letter is generated (shown in the `@` list). */
export type TemplateVariableDescriptions = Readonly<Record<string, string>>;

/**
 * Variables (those of the template's use, the built-in ones by default, then the
 * form fields of the document) and insertable elements, filtered by the query.
 */
export function templateSuggestionItems(
  editor: Editor,
  query: string,
  variables: TemplateVariableDescriptions = BUILTIN_VARIABLE_DESCRIPTIONS,
): TemplateSuggestionItem[] {
  const descriptions = new Map<string, string>(Object.entries(variables));
  for (const input of collectInputs(editor.getJSON())) {
    if (!descriptions.has(input.name)) {
      descriptions.set(input.name, `Champ du formulaire « ${input.label || input.name} »`);
    }
  }
  const items: TemplateSuggestionItem[] = [
    ...[...descriptions].map(([name, description]) => ({
      key: `var:${name}`,
      label: name,
      group: 'Variables' as const,
      description,
      run: insertVariable(name),
    })),
    ...INSERT_ITEMS,
  ];
  const needle = normalize(query.trim());
  if (!needle) return items;
  return items.filter((item) =>
    normalize(`${item.label} ${item.keywords ?? ''} ${item.description ?? ''}`).includes(needle),
  );
}

/** `@` opens the template suggestion list. */
export function createTemplateMention(
  getRenderer: () => TemplateSuggestionRenderer,
  getVariables: () => TemplateVariableDescriptions | undefined = () => undefined,
) {
  return Extension.create({
    name: 'templateMention',

    addProseMirrorPlugins() {
      return [
        Suggestion<TemplateSuggestionItem, TemplateSuggestionItem>({
          editor: this.editor,
          pluginKey: new PluginKey('templateMention'),
          char: '@',
          items: ({ editor, query }) => templateSuggestionItems(editor, query, getVariables()),
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => ({
            onStart: (props) => getRenderer().onOpen(props),
            onUpdate: (props) => getRenderer().onUpdate(props),
            onExit: () => getRenderer().onExit(),
            onKeyDown: (props) => getRenderer().onKeyDown(props),
          }),
        }),
      ];
    },
  });
}
