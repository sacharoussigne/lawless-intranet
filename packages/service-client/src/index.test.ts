import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceFetch, ServiceClientError, toQuery } from './index';

class TestClientError extends ServiceClientError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'TestClientError';
  }
}

const baseConfig = {
  label: 'Test',
  urlEnv: 'TEST_SERVICE_URL',
  defaultUrl: 'http://localhost:9999',
  secretEnv: 'TEST_SERVICE_SECRET',
  secretHeader: 'x-test-internal-secret',
  createError: (message: string, status: number) => new TestClientError(message, status),
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response('{}'));
  process.env.TEST_SERVICE_SECRET = 'secret';
  delete process.env.TEST_SERVICE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function sentHeaders(): Headers {
  const init = fetchMock.mock.calls[0]?.[1];
  return new Headers(init?.headers);
}

describe('createServiceFetch', () => {
  it('uses the env URL, forwards the cookie and sets JSON content type for a body', async () => {
    process.env.TEST_SERVICE_URL = 'http://svc';
    const client = createServiceFetch(baseConfig);
    await client.fetch('/api/x', { method: 'POST', body: '{}', cookieHeader: 'a=b' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://svc/api/x');
    expect(sentHeaders().get('cookie')).toBe('a=b');
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
    expect(sentHeaders().has('x-test-internal-secret')).toBe(false);
  });

  it('sends the secret only for internal calls in opt-in mode', async () => {
    const client = createServiceFetch(baseConfig);
    await client.fetch('/api/x', { internal: true });
    expect(sentHeaders().get('x-test-internal-secret')).toBe('secret');
  });

  it('always sends the secret in always mode', async () => {
    const client = createServiceFetch({ ...baseConfig, secret: 'always' });
    await client.fetch('/api/x');
    expect(sentHeaders().get('x-test-internal-secret')).toBe('secret');
  });

  it('throws a typed 500 when the secret is missing', async () => {
    delete process.env.TEST_SERVICE_SECRET;
    const client = createServiceFetch(baseConfig);
    await expect(client.fetch('/api/x', { internal: true })).rejects.toMatchObject({
      name: 'TestClientError',
      status: 500,
    });
  });

  it('maps network failures to 503 when configured', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const client = createServiceFetch({ ...baseConfig, unreachableMessage: 'Injoignable' });
    const error = await client.fetch('/api/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TestClientError);
    expect(error).toBeInstanceOf(ServiceClientError);
    expect(error).toMatchObject({ message: 'Injoignable', status: 503 });
  });
});

describe('parseJsonResponse', () => {
  const { parseJsonResponse } = createServiceFetch(baseConfig);

  it('parses JSON and handles empty bodies', async () => {
    await expect(parseJsonResponse(new Response('{"a":1}'))).resolves.toEqual({ a: 1 });
    await expect(parseJsonResponse(new Response(null, { status: 204 }))).resolves.toBeUndefined();
    await expect(parseJsonResponse(new Response(''))).resolves.toBeUndefined();
  });

  it('uses the API error message or a generic one', async () => {
    await expect(
      parseJsonResponse(new Response('{"error":"Interdit"}', { status: 403 })),
    ).rejects.toMatchObject({ message: 'Interdit', status: 403 });
    await expect(parseJsonResponse(new Response('oops', { status: 502 }))).rejects.toMatchObject({
      message: 'Test API error (502)',
      status: 502,
    });
  });
});

describe('toQuery', () => {
  it('skips empty values and repeats arrays', () => {
    expect(toQuery({ a: 1, b: undefined, c: null, d: false, ids: ['x', 'y'] })).toBe(
      '?a=1&d=false&ids=x&ids=y',
    );
    expect(toQuery({})).toBe('');
  });
});
