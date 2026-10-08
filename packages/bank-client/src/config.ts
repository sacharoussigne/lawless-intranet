import {
  createServiceFetch,
  ServiceClientError,
  toQuery,
  type ServiceFetchOptions,
} from '@lawless-intranet/service-client';

export const BANK_INTERNAL_SECRET_HEADER = 'x-bank-internal-secret';

export class BankClientError extends ServiceClientError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = 'BankClientError';
  }
}

const client = createServiceFetch({
  label: 'Bank',
  urlEnv: 'BANK_URL',
  defaultUrl: 'http://localhost:3004',
  secretEnv: 'BANK_INTERNAL_SECRET',
  secretHeader: BANK_INTERNAL_SECRET_HEADER,
  createError: (message, status) => new BankClientError(message, status),
});

export const getBankUrl = client.getUrl;
export const parseJsonResponse = client.parseJsonResponse;
export { toQuery };

export type BankFetchOptions = ServiceFetchOptions;
export const bankFetch = client.fetch;
