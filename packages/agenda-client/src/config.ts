import {
  createServiceFetch,
  ServiceClientError,
  toQuery,
  type ServiceFetchOptions,
} from '@lawless-intranet/service-client';

export const AGENDA_INTERNAL_SECRET_HEADER = 'x-agenda-internal-secret';

export class AgendaClientError extends ServiceClientError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = 'AgendaClientError';
  }
}

const client = createServiceFetch({
  label: 'Agenda',
  urlEnv: 'AGENDA_URL',
  defaultUrl: 'http://localhost:3003',
  secretEnv: 'AGENDA_INTERNAL_SECRET',
  secretHeader: AGENDA_INTERNAL_SECRET_HEADER,
  createError: (message, status) => new AgendaClientError(message, status),
});

export const getAgendaUrl = client.getUrl;
export const parseJsonResponse = client.parseJsonResponse;
export { toQuery };

export type AgendaFetchOptions = Omit<ServiceFetchOptions, 'internal'> & {
  /** When true, sends the host-only internal secret (required for scopeAdmin ops). */
  scopeAdmin?: boolean;
};

export function agendaFetch(path: string, init: AgendaFetchOptions = {}): Promise<Response> {
  const { scopeAdmin, ...rest } = init;
  return client.fetch(path, { ...rest, internal: scopeAdmin });
}
