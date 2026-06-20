'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_TEMPLATE_USERNAME,
  type RenderContext,
  type UserGender,
} from '@lawless-intranet/mail-template-engine';

interface MailTemplateContextValue {
  username: string;
  userDescription: string;
  userGender: UserGender;
}

const MailTemplateContext = createContext<MailTemplateContextValue>({
  username: DEFAULT_TEMPLATE_USERNAME,
  userDescription: '',
  userGender: 'male',
});

interface MailTemplateProviderProps {
  username: string;
  userDescription?: string | null;
  userGender?: UserGender;
  children: ReactNode;
}

export function MailTemplateProvider({
  username,
  userDescription,
  userGender = 'male',
  children,
}: MailTemplateProviderProps) {
  const normalizedUsername = username.trim() || DEFAULT_TEMPLATE_USERNAME;

  return (
    <MailTemplateContext.Provider
      value={{
        username: normalizedUsername,
        userDescription: userDescription?.trim() ?? '',
        userGender,
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
  userGender: UserGender,
  partial: Pick<RenderContext, 'inputs'> & {
    variables?: Record<string, string>;
    username?: string;
    userDescription?: string;
    userGender?: UserGender;
  },
): RenderContext {
  return {
    inputs: partial.inputs,
    username: partial.username ?? username,
    userDescription: partial.userDescription ?? userDescription,
    userGender: partial.userGender ?? userGender,
    variables: partial.variables,
  };
}

export function useTemplateRenderContext(
  partial: Pick<RenderContext, 'inputs'> & {
    variables?: Record<string, string>;
    username?: string;
    userDescription?: string;
    userGender?: UserGender;
  },
): RenderContext {
  const { username, userDescription, userGender } = useMailTemplateContext();
  return buildTemplateRenderContext(username, userDescription, userGender, partial);
}
