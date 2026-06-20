'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_TEMPLATE_USERNAME,
  type RenderContext,
} from '@lawless-intranet/mail-template-engine';

interface MailTemplateContextValue {
  username: string;
  userDescription: string;
}

const MailTemplateContext = createContext<MailTemplateContextValue>({
  username: DEFAULT_TEMPLATE_USERNAME,
  userDescription: '',
});

interface MailTemplateProviderProps {
  username: string;
  userDescription?: string | null;
  children: ReactNode;
}

export function MailTemplateProvider({
  username,
  userDescription,
  children,
}: MailTemplateProviderProps) {
  const normalizedUsername = username.trim() || DEFAULT_TEMPLATE_USERNAME;

  return (
    <MailTemplateContext.Provider
      value={{
        username: normalizedUsername,
        userDescription: userDescription?.trim() ?? '',
      }}
    >
      {children}
    </MailTemplateContext.Provider>
  );
}

export function useMailTemplateContext(): MailTemplateContextValue {
  return useContext(MailTemplateContext);
}

export function buildTemplateRenderContext(
  username: string,
  userDescription: string,
  partial: Pick<RenderContext, 'inputs'> & {
    variables?: Record<string, string>;
    username?: string;
    userDescription?: string;
  },
): RenderContext {
  return {
    inputs: partial.inputs,
    username: partial.username ?? username,
    userDescription: partial.userDescription ?? userDescription,
    variables: partial.variables,
  };
}

export function useTemplateRenderContext(
  partial: Pick<RenderContext, 'inputs'> & {
    variables?: Record<string, string>;
    username?: string;
    userDescription?: string;
  },
): RenderContext {
  const { username, userDescription } = useMailTemplateContext();
  return buildTemplateRenderContext(username, userDescription, partial);
}
