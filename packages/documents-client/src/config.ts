import {
  createServiceFetch,
  ServiceClientError,
  toQuery,
  type ServiceFetchOptions,
} from '@lawless-intranet/service-client';

export const DOCUMENTS_INTERNAL_SECRET_HEADER = 'x-documents-internal-secret';

export class DocumentsClientError extends ServiceClientError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = 'DocumentsClientError';
  }
}

const client = createServiceFetch({
  label: 'Documents',
  urlEnv: 'DOCUMENTS_URL',
  defaultUrl: 'http://localhost:3002',
  secretEnv: 'DOCUMENTS_INTERNAL_SECRET',
  secretHeader: DOCUMENTS_INTERNAL_SECRET_HEADER,
  secret: 'always',
  createError: (message, status) => new DocumentsClientError(message, status),
});

export const getDocumentsUrl = client.getUrl;
export const parseJsonResponse = client.parseJsonResponse;
export { toQuery };

/** Every call carries the internal secret. */
export type DocumentsFetchOptions = Omit<ServiceFetchOptions, 'internal'>;
export const documentsFetch: (path: string, init?: DocumentsFetchOptions) => Promise<Response> =
  client.fetch;
