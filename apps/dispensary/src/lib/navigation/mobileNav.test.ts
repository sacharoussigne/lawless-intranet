import { describe, expect, it } from 'vitest';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import type { Permissions } from '@/types/permissions';
import { tenantRoutes } from '@/types/routes';
import { getActiveMobileTab, getMobileSectionTitle, getMobileTabs, type MobileNavContext } from './mobileNav';

const t = tenantRoutes('saint-denis');

function ctx(overrides: Partial<MobileNavContext> & { media?: boolean } = {}): MobileNavContext {
  const { media = true, ...rest } = overrides;
  return {
    t,
    appSettings: APP_SETTINGS_DEFAULTS,
    permissions: { media: { access: media } } as unknown as Permissions,
    agendaModuleAccess: true,
    ...rest,
  };
}

describe('getMobileTabs', () => {
  it('shows the five tabs with every access', () => {
    expect(getMobileTabs(ctx()).map((tab) => tab.id)).toEqual(['home', 'agenda', 'tasks', 'media', 'account']);
  });

  it('hides the media library without the permission or the feature', () => {
    expect(getMobileTabs(ctx({ media: false })).map((tab) => tab.id)).not.toContain('media');
    const disabled = { ...APP_SETTINGS_DEFAULTS, featureMediaEnabled: false };
    expect(getMobileTabs(ctx({ appSettings: disabled })).map((tab) => tab.id)).not.toContain('media');
  });

  it('hides agenda and tasks without agenda access', () => {
    expect(getMobileTabs(ctx({ agendaModuleAccess: false })).map((tab) => tab.id)).toEqual([
      'home',
      'media',
      'account',
    ]);
  });
});

describe('getActiveMobileTab', () => {
  it('matches each tab, tasks before agenda', () => {
    expect(getActiveMobileTab(t.employee.index, t)).toBe('home');
    expect(getActiveMobileTab(t.agenda.index, t)).toBe('agenda');
    expect(getActiveMobileTab(t.agenda.tasks, t)).toBe('tasks');
    expect(getActiveMobileTab(`${t.media.index}`, t)).toBe('media');
    expect(getActiveMobileTab(t.employee.account, t)).toBe('account');
  });

  it('keeps home exact and ignores other modules', () => {
    expect(getActiveMobileTab(t.stock.index, t)).toBeNull();
    expect(getActiveMobileTab(t.employee.sales, t)).toBeNull();
  });
});

describe('getMobileSectionTitle', () => {
  it('uses the tab name, the fallback elsewhere', () => {
    expect(getMobileSectionTitle(t.agenda.tasks, t, 'Saint-Denis')).toBe('Tâches');
    expect(getMobileSectionTitle(t.stock.index, t, 'Saint-Denis')).toBe('Saint-Denis');
  });
});
