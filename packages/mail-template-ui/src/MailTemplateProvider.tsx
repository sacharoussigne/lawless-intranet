'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_TEMPLATE_USERNAME,
  type RenderContext,
} from '@lawless-intranet/mail-template-engine';

interface MailTemplateContextValue {
  username: string;
}

const MailTemplateContext = createContext<MailTemplateContextValue>({
  username: DEFAULT_TEMPLATE_USERNAME,
});

interface MailTemplateProviderProps {
  username: string;
  children: ReactNode;
}

export function MailTemplateProvider({
  username,
  children,
}: MailTemplateProviderProps) {
  const normalizedUsername = username.trim() || DEFAULT_TEMPLATE_USERNAME;

  return (
    <MailTemplateContext.Provider value={{ username: normalizedUsername }}>
      {children}
    </MailTemplateContext.Provider>
  );
}

export function useMailTemplateContext(): MailTemplateContextValue {
  return useContext(MailTemplateContext);
}

export function buildTemplateRenderContext(
  username: string,
  partial: Pick<RenderContext, 'inputs'> & {
    variables?: Record<string, string>;
    username?: string;
  }
): RenderContext {
  return {
    inputs: partial.inputs,
    username: partial.username ?? username,
    variables: partial.variables,
  };
}

export function useTemplateRenderContext(
  partial: Pick<RenderContext, 'inputs'> & {
    variables?: Record<string, string>;
    username?: string;
  }
): RenderContext {
  const { username } = useMailTemplateContext();
  return buildTemplateRenderContext(username, partial);
}
