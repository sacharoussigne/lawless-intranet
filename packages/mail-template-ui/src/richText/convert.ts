import {
  parseTemplateDocumentEntries,
  serializeSegment,
  type TemplateInput,
  type TemplateSegment,
} from '@lawless-intranet/mail-template-engine';
import type { JSONContent } from '@tiptap/core';

/** Segments shown as a pill (everything but text). */
export type TokenSegment = Exclude<TemplateSegment, { kind: 'text' }>;

export const VARIABLE_NODE = 'templateVariable';
export const TOKEN_NODE = 'templateToken';

const VARIABLE_PATTERN = /\$\{(\w+)\}/g;

function textToNodes(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let cursor = 0;
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: 'text', text: text.slice(cursor, index) });
    nodes.push({ type: VARIABLE_NODE, attrs: { name: match[1] } });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) nodes.push({ type: 'text', text: text.slice(cursor) });
  return nodes;
}

/**
 * Template string to an editor document: one paragraph per line, `${name}` and the other
 * template elements as inline pills. Pills keep their source text (`raw`) for a lossless round trip.
 */
export function templateToEditorDoc(content: string): JSONContent {
  const paragraphs: JSONContent[][] = [[]];
  const current = () => paragraphs[paragraphs.length - 1];

  for (const { segment, raw } of parseTemplateDocumentEntries(content).entries) {
    if (segment.kind !== 'text') {
      current().push({ type: TOKEN_NODE, attrs: { segment, raw } });
      continue;
    }
    segment.value.split('\n').forEach((line, index) => {
      if (index > 0) paragraphs.push([]);
      current().push(...textToNodes(line));
    });
  }

  return {
    type: 'doc',
    content: paragraphs.map((nodes) =>
      nodes.length > 0 ? { type: 'paragraph', content: nodes } : { type: 'paragraph' },
    ),
  };
}

function nodeToTemplate(node: JSONContent): string {
  switch (node.type) {
    case 'text':
      return node.text ?? '';
    case VARIABLE_NODE:
      return `\${${String(node.attrs?.name ?? '')}}`;
    case TOKEN_NODE: {
      const raw = node.attrs?.raw;
      if (typeof raw === 'string' && raw) return raw;
      return serializeSegment(node.attrs?.segment as TokenSegment);
    }
    default:
      return (node.content ?? []).map(nodeToTemplate).join('');
  }
}

/** Editor document back to the template string (paragraphs joined by line breaks). */
export function editorDocToTemplate(doc: JSONContent): string {
  return (doc.content ?? []).map(nodeToTemplate).join('\n');
}

/** Form fields defined in a document (first one per name), offered as variables. */
export function collectInputs(doc: JSONContent): TemplateInput[] {
  const inputs = new Map<string, TemplateInput>();
  const visit = (node: JSONContent) => {
    if (node.type === TOKEN_NODE) {
      const segment = node.attrs?.segment as TokenSegment | undefined;
      if (segment?.kind === 'input' && segment.input.name && !inputs.has(segment.input.name)) {
        inputs.set(segment.input.name, segment.input);
      }
    }
    node.content?.forEach(visit);
  };
  visit(doc);
  return [...inputs.values()];
}

/** Top-level checkbox fields, which other fields can depend on. */
export function collectCheckboxNames(doc: JSONContent): string[] {
  const names: string[] = [];
  const visit = (node: JSONContent) => {
    if (node.type === TOKEN_NODE) {
      const segment = node.attrs?.segment as TokenSegment | undefined;
      if (segment?.kind === 'input' && segment.input.type === 'checkbox' && !segment.input.dependsOn) {
        names.push(segment.input.name);
      }
    }
    node.content?.forEach(visit);
  };
  visit(doc);
  return names;
}

/** Short label of a pill. */
export function tokenSummary(segment: TokenSegment): string {
  switch (segment.kind) {
    case 'input':
      return `Champ · ${segment.input.label || segment.input.name}`;
    case 'category':
      return `Section · ${segment.title || 'sans titre'}`;
    case 'conditional':
      return 'eq' in segment
        ? `Si ${segment.var} = ${segment.eq}`
        : `Si ${segment.var} vide / rempli`;
    case 'js':
      return 'Code JS';
  }
}
