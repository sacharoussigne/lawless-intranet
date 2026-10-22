import { unescapeAttributeValue, parseInputAttributes } from './parser';
import type {
  ParseWarning,
  TemplateDocument,
  TemplateInput,
  TemplateSegment,
} from './types';

export type { ParseWarning, TemplateDocument, TemplateSegment };

const JS_PATTERN = /\{js:(.*?):endjs\}/g;
const INPUT_PATTERN = /\{input:\[(.*?)\]\}/g;
const CATEGORY_PATTERN = /\{category:"([^"]*)"\}/g;
const IF_PATTERN = /\{if:\[(.*?)\]\}/g;

const ATTRIBUTE_PATTERN =
  /(\w+)=(?:"([^"]*)"|((?:\{js:.*?:endjs\}|[^\]]*?))(?=\]|\[|$))/g;

type DocumentToken =
  | { kind: 'input'; start: number; end: number; input: TemplateInput }
  | { kind: 'category'; start: number; end: number; title: string }
  | {
      kind: 'conditional';
      start: number;
      end: number;
      var: string;
      empty?: string;
      filled?: string;
      eq?: string;
      then?: string;
      else?: string;
    }
  | { kind: 'js'; start: number; end: number; code: string };

function collectInputSpans(content: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  INPUT_PATTERN.lastIndex = 0;
  let match;
  while ((match = INPUT_PATTERN.exec(content)) !== null) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
}

function overlapsInputSpan(
  start: number,
  end: number,
  inputSpans: { start: number; end: number }[],
): boolean {
  return inputSpans.some((s) => start < s.end && end > s.start);
}

function parseConditionalAttributes(attributesString: string): {
  var: string;
  empty?: string;
  filled?: string;
  eq?: string;
  then?: string;
  else?: string;
} {
  const attrs = {
    var: '',
    empty: undefined as string | undefined,
    filled: undefined as string | undefined,
    eq: undefined as string | undefined,
    then: undefined as string | undefined,
    else: undefined as string | undefined,
  };
  let match;

  while ((match = ATTRIBUTE_PATTERN.exec(attributesString)) !== null) {
    const [, key, quotedValue, unquotedValue] = match;
    const rawValue =
      quotedValue !== undefined ? quotedValue : (unquotedValue || '').trim();
    const value = unescapeAttributeValue(rawValue);

    if (key === 'var') attrs.var = value;
    else if (key === 'empty') attrs.empty = value;
    else if (key === 'filled') attrs.filled = value;
    else if (key === 'eq') attrs.eq = value;
    else if (key === 'then') attrs.then = value;
    else if (key === 'else') attrs.else = value;
  }

  return attrs;
}

function collectDocumentTokens(content: string): DocumentToken[] {
  const tokens: DocumentToken[] = [];
  const inputSpans = collectInputSpans(content);

  INPUT_PATTERN.lastIndex = 0;
  let match;
  while ((match = INPUT_PATTERN.exec(content)) !== null) {
    tokens.push({
      kind: 'input',
      start: match.index,
      end: match.index + match[0].length,
      input: parseInputAttributes(match[1]),
    });
  }

  CATEGORY_PATTERN.lastIndex = 0;
  while ((match = CATEGORY_PATTERN.exec(content)) !== null) {
    tokens.push({
      kind: 'category',
      start: match.index,
      end: match.index + match[0].length,
      title: unescapeAttributeValue(match[1]),
    });
  }

  IF_PATTERN.lastIndex = 0;
  while ((match = IF_PATTERN.exec(content)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (overlapsInputSpan(start, end, inputSpans)) continue;

    const attrs = parseConditionalAttributes(match[1]);
    tokens.push({
      kind: 'conditional',
      start,
      end,
      var: attrs.var,
      empty: attrs.empty,
      filled: attrs.filled,
      eq: attrs.eq,
      then: attrs.then,
      else: attrs.else,
    });
  }

  JS_PATTERN.lastIndex = 0;
  while ((match = JS_PATTERN.exec(content)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    if (overlapsInputSpan(start, end, inputSpans)) continue;

    tokens.push({
      kind: 'js',
      start,
      end,
      code: match[1],
    });
  }

  return tokens.sort((a, b) => a.start - b.start);
}

/** A segment with the exact source text it was read from. */
export interface TemplateDocumentEntry {
  segment: TemplateSegment;
  raw: string;
}

export function parseTemplateDocument(content: string): {
  document: TemplateDocument;
  warnings: ParseWarning[];
} {
  const { entries, warnings } = parseTemplateDocumentEntries(content);
  return { document: { segments: entries.map((entry) => entry.segment) }, warnings };
}

/**
 * Same as `parseTemplateDocument`, keeping each segment's source text, so an editor can write
 * untouched segments back verbatim (serializing may normalize attribute quoting and order).
 */
export function parseTemplateDocumentEntries(content: string): {
  entries: TemplateDocumentEntry[];
  warnings: ParseWarning[];
} {
  const tokens = collectDocumentTokens(content);
  const warnings: ParseWarning[] = [];
  const entries: TemplateDocumentEntry[] = [];
  const push = (segment: TemplateSegment, start: number, end: number) => {
    entries.push({ segment, raw: content.slice(start, end) });
  };
  let cursor = 0;

  for (const token of tokens) {
    if (token.start < cursor) {
      warnings.push({
        message: 'Overlapping template tokens detected; some content may be skipped',
        startIndex: token.start,
        endIndex: token.end,
      });
      continue;
    }

    if (token.start > cursor) {
      push({ kind: 'text', value: content.slice(cursor, token.start) }, cursor, token.start);
    }

    switch (token.kind) {
      case 'input':
        push({ kind: 'input', input: token.input }, token.start, token.end);
        break;
      case 'category':
        push({ kind: 'category', title: token.title }, token.start, token.end);
        break;
      case 'conditional':
        if (token.eq !== undefined) {
          push({
            kind: 'conditional',
            var: token.var,
            eq: token.eq,
            then: token.then ?? '',
            else: token.else ?? '',
          }, token.start, token.end);
        } else {
          push({
            kind: 'conditional',
            var: token.var,
            empty: token.empty ?? '',
            filled: token.filled ?? '',
          }, token.start, token.end);
        }
        break;
      case 'js':
        push({ kind: 'js', code: token.code }, token.start, token.end);
        break;
    }

    cursor = token.end;
  }

  if (cursor < content.length) {
    push({ kind: 'text', value: content.slice(cursor) }, cursor, content.length);
  }

  return { entries, warnings };
}

export function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
}

function formatAttributeValue(key: string, value: string): string {
  const trimmed = value.trim();
  if (
    (key === 'default' || key === 'defaultValue') &&
    /^\{js:.+:endjs\}$/.test(trimmed)
  ) {
    return trimmed;
  }
  return `"${escapeAttributeValue(value)}"`;
}

export function serializeInput(input: TemplateInput): string {
  const parts: string[] = [
    `[type=${formatAttributeValue('type', input.type)}]`,
    `[name=${formatAttributeValue('name', input.name)}]`,
  ];

  if (input.label && input.label !== input.name) {
    parts.push(`[label=${formatAttributeValue('label', input.label)}]`);
  }

  if (input.placeholder) {
    parts.push(`[placeholder=${formatAttributeValue('placeholder', input.placeholder)}]`);
  }
  if (input.required) {
    parts.push('[required="true"]');
  }
  if (input.defaultValue) {
    parts.push(`[default=${formatAttributeValue('default', input.defaultValue)}]`);
  }
  if (input.checkedValue) {
    parts.push(`[checkedValue=${formatAttributeValue('checkedValue', input.checkedValue)}]`);
  }
  if (input.dependsOn) {
    parts.push(`[dependsOn=${formatAttributeValue('dependsOn', input.dependsOn)}]`);
  }
  if (input.layout) {
    parts.push(`[layout=${formatAttributeValue('layout', input.layout)}]`);
  }
  if (input.options) {
    parts.push(`[options=${formatAttributeValue('options', input.options)}]`);
  }

  return `{input:${parts.join('')}}`;
}

export function serializeConditional(segment: Extract<TemplateSegment, { kind: 'conditional' }>): string {
  if ('eq' in segment) {
    const parts = [
      `[var=${formatAttributeValue('var', segment.var)}]`,
      `[eq=${formatAttributeValue('eq', segment.eq)}]`,
      `[then=${formatAttributeValue('then', segment.then)}]`,
      `[else=${formatAttributeValue('else', segment.else)}]`,
    ];
    return `{if:${parts.join('')}}`;
  }

  const parts = [
    `[var=${formatAttributeValue('var', segment.var)}]`,
    `[empty=${formatAttributeValue('empty', segment.empty)}]`,
    `[filled=${formatAttributeValue('filled', segment.filled)}]`,
  ];
  return `{if:${parts.join('')}}`;
}

export function serializeSegment(segment: TemplateSegment): string {
  switch (segment.kind) {
    case 'text':
      return segment.value;
    case 'input':
      return serializeInput(segment.input);
    case 'category':
      return `{category:"${escapeAttributeValue(segment.title)}"}`;
    case 'conditional':
      return serializeConditional(segment);
    case 'js':
      return `{js:${segment.code}:endjs}`;
  }
}

export function serializeTemplateDocument(document: TemplateDocument): string {
  return document.segments.map(serializeSegment).join('');
}

export function parseSelectOptions(options: string | undefined): string[] {
  if (!options?.trim()) return [];
  return options
    .split(/[|,]/)
    .map((option) => option.trim())
    .filter(Boolean);
}
