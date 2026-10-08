import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCors, createRouteResponses } from './http';
import { hasInternalSecret } from './internalSecret';

const getSessionMock = vi.hoisted(() => vi.fn());
vi.mock('@lawless-intranet/auth-client/server', () => ({ getSession: getSessionMock }));

const secretConfig = { env: 'KIT_TEST_SECRET', header: 'x-kit-internal-secret' };

function request(headers: Record<string, string> = {}) {
  return new Request('http://svc/api/x', { headers });
}

beforeEach(() => {
  process.env.KIT_TEST_SECRET = 'top-secret';
  getSessionMock.mockReset();
});

describe('hasInternalSecret', () => {
  it('accepts only the exact secret', () => {
    expect(hasInternalSecret(request({ 'x-kit-internal-secret': 'top-secret' }), secretConfig)).toBe(true);
    expect(hasInternalSecret(request({ 'x-kit-internal-secret': 'top-secreT' }), secretConfig)).toBe(false);
    expect(hasInternalSecret(request({ 'x-kit-internal-secret': 'short' }), secretConfig)).toBe(false);
    expect(hasInternalSecret(request(), secretConfig)).toBe(false);
  });

  it('rejects everything when the secret is not configured', () => {
    delete process.env.KIT_TEST_SECRET;
    expect(hasInternalSecret(request({ 'x-kit-internal-secret': '' }), secretConfig)).toBe(false);
  });
});

describe('createCors', () => {
  const { withCors, corsPreflightResponse } = createCors({
    getTrustedOrigins: () => ['http://app.localhost'],
    allowHeaders: 'Content-Type, X-Kit',
  });

  it('allows trusted origins only', () => {
    const trusted = corsPreflightResponse(request({ origin: 'http://app.localhost' }));
    expect(trusted.status).toBe(204);
    expect(trusted.headers.get('Access-Control-Allow-Origin')).toBe('http://app.localhost');
    expect(trusted.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-Kit');

    const response = withCors(request({ origin: 'http://evil.test' }), new Response() as never);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('createRouteResponses', () => {
  const { withCors } = createCors({ getTrustedOrigins: () => [] });

  it('returns 401 without a session and the context with one', async () => {
    const { requireSession } = createRouteResponses({ withCors });
    getSessionMock.mockResolvedValueOnce(null);
    const denied = await requireSession(request());
    expect(denied).toHaveProperty('status', 401);

    getSessionMock.mockResolvedValueOnce({ user: { id: 'u1' } });
    await expect(requireSession(request())).resolves.toMatchObject({ userId: 'u1' });
  });

  it('checks the internal secret first when configured', async () => {
    const { requireSession } = createRouteResponses({
      withCors,
      isInternalAuthorized: (req) => hasInternalSecret(req, secretConfig),
    });
    const forbidden = await requireSession(request());
    expect(forbidden).toHaveProperty('status', 403);
    expect(getSessionMock).not.toHaveBeenCalled();
  });
});
