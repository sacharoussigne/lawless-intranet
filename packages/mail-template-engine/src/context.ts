import type { RenderContext } from './types';

export const DEFAULT_TEMPLATE_USERNAME = 'Utilisateur';

export function resolveRenderVariables(
  context: RenderContext
): Record<string, string> | undefined {
  const hasUsername = context.username !== undefined;
  const hasUserDescription = context.userDescription !== undefined;
  const hasVariables =
    context.variables !== undefined && Object.keys(context.variables).length > 0;

  if (!hasUsername && !hasUserDescription && !hasVariables) {
    return undefined;
  }

  return {
    ...(hasUsername
      ? {
          username:
            context.username!.trim() || DEFAULT_TEMPLATE_USERNAME,
        }
      : {}),
    ...(hasUserDescription
      ? {
          description: context.userDescription!.trim(),
        }
      : {}),
    ...context.variables,
  };
}

export function buildRenderContext(
  context: RenderContext
): RenderContext {
  return {
    inputs: context.inputs,
    username: context.username,
    variables: resolveRenderVariables(context),
  };
}
