const VARIABLE_PATTERN = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export function resolveVariable(
  variables: Record<string, string>,
  name: string
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(variables, name)) {
    return variables[name];
  }

  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(variables)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
}

export function extractVariables(content: string): string[] {
  const names = new Set<string>();
  VARIABLE_PATTERN.lastIndex = 0;
  let match;
  while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
    names.add(match[1]);
  }
  return [...names];
}

export function substituteVariables(
  content: string,
  variables: Record<string, string> = {}
): string {
  return content.replace(VARIABLE_PATTERN, (fullMatch, name: string) => {
    const value = resolveVariable(variables, name);
    if (value !== undefined) {
      return value;
    }
    return fullMatch;
  });
}
