import { describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '@lawless-intranet/types';
import { applyViewAs, parseViewAsCookie, serializeViewAsCookie, viewAsCookieFromHeader } from './viewAs';

const session = (role: string) => ({ session: { id: 's', expiresAt: '' }, user: { id: 'u1', role } }) as AuthSession;
const header = (value: string) => `disp-theme=clair; disp-view-as=${encodeURIComponent(value)}`;

describe('parseViewAsCookie', () => {
  it('reads the business and the known roles', () => {
    expect(parseViewAsCookie('b1:employee,direction')).toEqual({ businessId: 'b1', roles: ['direction', 'employee'] });
    expect(parseViewAsCookie(encodeURIComponent(serializeViewAsCookie({ businessId: 'b1', roles: ['admin'] })))).toEqual({
      businessId: 'b1',
      roles: ['admin'],
    });
  });

  it('ignores malformed values and unknown roles', () => {
    expect(parseViewAsCookie(null)).toBeNull();
    expect(parseViewAsCookie('b1')).toBeNull();
    expect(parseViewAsCookie(':employee')).toBeNull();
    expect(parseViewAsCookie('b1:barman,user')).toBeNull();
  });

  it('finds the cookie in a header', () => {
    expect(viewAsCookieFromHeader(header('b1:employee'))).toBe(encodeURIComponent('b1:employee'));
    expect(viewAsCookieFromHeader('disp-theme=clair')).toBeNull();
  });
});

describe('applyViewAs', () => {
  it('leaves the session alone without a cookie', async () => {
    const check = vi.fn();
    const s = session('admin');
    expect(await applyViewAs(s, 'disp-theme=clair', check)).toBe(s);
    expect(check).not.toHaveBeenCalled();
  });

  it('drops the platform role of an admin and keeps the view', async () => {
    const result = await applyViewAs(session('admin'), header('b1:employee'), vi.fn());
    expect(result?.user.role).toBe('user');
    expect(result?.viewAs).toEqual({ businessId: 'b1', roles: 'employee', realRole: 'admin' });
  });

  it('accepts an admin of that business', async () => {
    const check = vi.fn().mockResolvedValue(true);
    const result = await applyViewAs(session('user'), header('b1:employee'), check);
    expect(check).toHaveBeenCalledWith('u1', 'b1');
    expect(result?.viewAs?.roles).toBe('employee');
  });

  it('ignores the cookie of a non-admin', async () => {
    const s = session('user');
    expect(await applyViewAs(s, header('b1:admin'), vi.fn().mockResolvedValue(false))).toBe(s);
  });
});
