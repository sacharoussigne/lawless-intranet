import {
  createServiceFetch,
  ServiceClientError,
  toQuery,
  type ServiceFetchOptions,
} from '@lawless-intranet/service-client';

export const MEDIA_INTERNAL_SECRET_HEADER = 'x-media-internal-secret';

export class MediaClientError extends ServiceClientError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = 'MediaClientError';
  }
}

const client = createServiceFetch({
  label: 'Media',
  urlEnv: 'MEDIA_URL',
  defaultUrl: 'http://localhost:3009',
  secretEnv: 'MEDIA_INTERNAL_SECRET',
  secretHeader: MEDIA_INTERNAL_SECRET_HEADER,
  secret: 'always',
  unreachableMessage: 'Service médiathèque injoignable',
  createError: (message, status) => new MediaClientError(message, status),
});

export const getMediaUrl = client.getUrl;
export const parseJsonResponse = client.parseJsonResponse;
export { toQuery };

/** Server-side only: every call carries the internal secret. */
export type MediaFetchOptions = Omit<ServiceFetchOptions, 'internal'>;
export const mediaFetch: (path: string, init?: MediaFetchOptions) => Promise<Response> =
  client.fetch;
