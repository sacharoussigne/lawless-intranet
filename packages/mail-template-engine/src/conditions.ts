import { unescapeAttributeValue } from './parser';
import { resolveVariable } from './variables';

const IF_PATTERN = /\{if:\[(.*?)\]\}/g;

const ATTRIBUTE_PATTERN =
  /(\w+)=(?:"([^"]*)"|((?:\{js:.*?:endjs\}|[^\]]*?))(?=\]|\[|$))/g;

type ConditionalAttributes = {
  var?: string;
  empty?: string;
  filled?: string;
  eq?: string;
  then?: string;
  else?: string;
};

function parseConditionalAttributes(attributesString: string): ConditionalAttributes {
  const attrs: ConditionalAttributes = {};
  let match;

  while ((match = ATTRIBUTE_PATTERN.exec(attributesString)) !== null) {
    const [, key, quotedValue, unquotedValue] = match;
    const rawValue =
      quotedValue !== undefined ? quotedValue : (unquotedValue || '').trim();
    const value = unescapeAttributeValue(rawValue);

    if (key === 'var') {
      attrs.var = value;
    } else if (key === 'empty') {
      attrs.empty = value;
    } else if (key === 'filled') {
      attrs.filled = value;
    } else if (key === 'eq') {
      attrs.eq = value;
    } else if (key === 'then') {
      attrs.then = value;
    } else if (key === 'else') {
      attrs.else = value;
    }
  }

  return attrs;
}

function isVariableEmpty(
  variables: Record<string, string>,
  varName: string | undefined,
): boolean {
  if (!varName) {
    return true;
  }

  const value = resolveVariable(variables, varName);
  return value === undefined || value.trim() === '';
}

export function processConditionalBlocks(
  content: string,
  variables: Record<string, string> = {},
): string {
  IF_PATTERN.lastIndex = 0;

  return content.replace(IF_PATTERN, (_fullMatch, attributesString: string) => {
    const attrs = parseConditionalAttributes(attributesString);

    if (attrs.eq !== undefined) {
      const then = attrs.then ?? '';
      const elseBranch = attrs.else ?? '';
      const actual = resolveVariable(variables, attrs.var ?? '');
      const expected = attrs.eq ?? '';
      const matches =
        actual !== undefined &&
        actual.localeCompare(expected, undefined, { sensitivity: 'accent' }) === 0;
      return matches ? then : elseBranch;
    }

    const empty = attrs.empty ?? '';
    const filled = attrs.filled ?? '';

    return isVariableEmpty(variables, attrs.var) ? empty : filled;
  });
}
