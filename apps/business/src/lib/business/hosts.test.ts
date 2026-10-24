import { afterEach, describe, expect, it, vi } from 'vitest';
import { businessOrigin, businessTypeOfHost, publicBusinessOrigin, requestHostOf } from '@/lib/business/hosts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('business hosts', () => {
  it('do nothing without BUSINESS_TYPE_HOSTS', () => {
    vi.stubEnv('BUSINESS_TYPE_HOSTS', '');
    expect(businessTypeOfHost('dispensary.localhost:3000')).toBeNull();
    expect(businessOrigin('DISPENSARY', { host: 'business.localhost:3000', proto: 'http' })).toBe('');
  });

  it('map a host to its kind of business, unknown kinds ignored', () => {
    vi.stubEnv('BUSINESS_TYPE_HOSTS', 'DISPENSARY=dispensary.localhost:3000, SALOON=saloon.localhost:3000');
    expect(businessTypeOfHost('Dispensary.localhost:3000')).toBe('DISPENSARY');
    expect(businessTypeOfHost('saloon.localhost:3000')).toBeNull();
    expect(businessTypeOfHost('business.localhost:3000')).toBeNull();
  });

  it('stay on the current host when it serves the business, or on the main host', () => {
    vi.stubEnv('BUSINESS_TYPE_HOSTS', 'DISPENSARY=dispensaire.aerokusu.fr');
    expect(businessOrigin('DISPENSARY', { host: 'dispensaire.aerokusu.fr', proto: 'https' })).toBe('');
    expect(businessOrigin('DISPENSARY', { host: 'business.aerokusu.fr', proto: 'https' })).toBe('');
  });

  it('read the host behind the proxy', () => {
    const headers = new Headers({ host: 'app:3000', 'x-forwarded-host': 'gs.aerokusu.fr', 'x-forwarded-proto': 'https' });
    expect(requestHostOf(headers)).toEqual({ host: 'gs.aerokusu.fr', proto: 'https' });
  });

  it('give an absolute origin for links from outside the app', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://business.aerokusu.fr/');
    vi.stubEnv('BUSINESS_TYPE_HOSTS', 'DISPENSARY=dispensaire.aerokusu.fr');
    expect(publicBusinessOrigin('DISPENSARY')).toBe('https://dispensaire.aerokusu.fr');
    vi.stubEnv('BUSINESS_TYPE_HOSTS', '');
    expect(publicBusinessOrigin('DISPENSARY')).toBe('https://business.aerokusu.fr');
  });
});
