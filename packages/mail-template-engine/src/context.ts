import type { RenderContext, UserGender } from './types';

export const DEFAULT_TEMPLATE_USERNAME = 'Utilisateur';

export function resolveRenderVariables(
  context: RenderContext
): Record<string, string> | undefined {
  const hasUsername = context.username !== undefined;
  const hasUserDescription = context.userDescription !== undefined;
  const hasUserGender = context.userGender !== undefined;
  const hasVariables =
    context.variables !== undefined && Object.keys(context.variables).length > 0;

  if (!hasUsername && !hasUserDescription && !hasUserGender && !hasVariables) {
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
    ...(hasUserGender
      ? {
          gender: context.userGender!,
        }
      : {}),
    ...context.variables,
  };
}

export function buildUserTemplateRenderContext(options: {
  username?: string;
  userDescription?: string;
  userGender?: UserGender;
  inputs: Record<string, string>;
  variables?: Record<string, string>;
}): RenderContext {
  return {
    inputs: options.inputs,
    username: options.username,
    userDescription: options.userDescription,
    userGender: options.userGender,
    variables: options.variables,
  };
}

export function buildRenderContext(
  context: RenderContext
): RenderContext {
  return {
    inputs: context.inputs,
    username: context.username,
    userDescription: context.userDescription,
    userGender: context.userGender,
    variables: resolveRenderVariables(context),
  };
}
