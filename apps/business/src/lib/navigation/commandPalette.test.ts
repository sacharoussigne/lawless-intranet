import { describe, expect, it } from 'vitest';
import { APP_SETTINGS_DEFAULTS } from '@/lib/appSettingsShared';
import type { Permissions } from '@/types/permissions';
import { tenantRoutes } from '@/types/routes';
import {
  type CommandPaletteContext,
  commandEntryTitle,
  filterCommandEntries,
  getCommandPaletteEntries,
  parsePaletteQuery,
} from './commandPalette';

/** Every right granted: each test removes what it checks. */
function allPermissions(): Permissions {
  const yes = new Proxy({}, { get: () => true });
  return new Proxy({}, { get: () => yes }) as Permissions;
}

function context(overrides: Partial<CommandPaletteContext> = {}): CommandPaletteContext {
  return {
    t: tenantRoutes('saint-denis'),
    appSettings: { ...APP_SETTINGS_DEFAULTS, featureLettersEnabled: true },
    permissions: allPermissions(),
    userRole: null,
    cabinetModuleAccess: true,
    letterBoxModuleAccess: true,
    hasAccessibleChests: true,
    agendaModuleAccess: true,
    isAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

const labels = (ctx: CommandPaletteContext) => getCommandPaletteEntries(ctx).map(commandEntryTitle);

describe('getCommandPaletteEntries', () => {
  it('lists pages and quick actions the user can reach', () => {
    const all = labels(context());
    expect(all).toEqual(
      expect.arrayContaining(['Lettres', 'Activité › Salaires', 'Stocks › Inventaire', 'Créer une commande', 'Récap des heures']),
    );
    expect(all).not.toContain('Administration');
    expect(all).not.toContain('Plateforme');
  });

  it('opens the agenda on one panel only', () => {
    const entries = getCommandPaletteEntries(context());
    expect(entries.find((entry) => entry.label === 'Todo')?.href).toBe('/saint-denis/employee/agenda/taches?panels=todo');
    expect(entries.find((entry) => entry.label === 'Calendrier')?.href).toBe('/saint-denis/employee/agenda?panels=calendar');
    expect(labels(context({ agendaModuleAccess: false }))).not.toContain('Agenda › Todo');
  });

  it('hides a page without its module or access', () => {
    expect(labels(context({ letterBoxModuleAccess: false }))).not.toContain('Lettres');
    expect(labels(context({ appSettings: { ...APP_SETTINGS_DEFAULTS, featureLettersEnabled: false } }))).not.toContain(
      'Lettres',
    );
  });

  it('hides an action without its right', () => {
    const permissions = allPermissions();
    const noCreate = new Proxy(permissions, {
      get: (target, key) => (key === 'orders' ? { view: true, create: false } : Reflect.get(target, key)),
    });
    expect(labels(context({ permissions: noCreate }))).not.toContain('Créer une commande');
  });

  it('adds the admin and platform pages for their roles', () => {
    const all = labels(context({ isAdmin: true, isPlatformAdmin: true }));
    expect(all).toEqual(expect.arrayContaining(['Administration', 'Admin › Boîtes aux lettres', 'Plateforme › Logs']));
  });

  it('opens the modal of a quick action through ?action=', () => {
    const entry = getCommandPaletteEntries(context()).find((item) => item.label === 'Créer une commande');
    expect(entry?.href).toBe('/saint-denis/employee/orders?action=create');
  });
});

describe('filterCommandEntries', () => {
  const entries = getCommandPaletteEntries(context({ isAdmin: true }));
  const titles = (query: string) => filterCommandEntries(entries, query).map(commandEntryTitle);

  it('ignores case and accents', () => {
    expect(titles('LETTRES')[0]).toBe('Lettres');
    expect(titles('activite')).toContain('Activité › Activité hebdo');
  });

  it('finds a page by a keyword', () => {
    expect(titles('paie')).toContain('Activité › Salaires');
  });

  it('needs every typed word', () => {
    expect(titles('creer com')).toEqual(['Créer une commande']);
    expect(titles('recap')).toContain('Récap des heures');
  });

  it('puts labels starting with the query first', () => {
    expect(titles('com')[0]).toBe('Commandes');
  });

  it('returns everything for an empty query, nothing when no word matches', () => {
    expect(filterCommandEntries(entries, '  ')).toHaveLength(entries.length);
    expect(titles('zzz')).toEqual([]);
  });
});

describe('parsePaletteQuery', () => {
  it('switches to the entity search with « @ »', () => {
    expect(parsePaletteQuery('  @ george ')).toEqual({ mode: 'entities', text: 'george' });
    expect(parsePaletteQuery('@')).toEqual({ mode: 'entities', text: '' });
  });

  it('stays on pages and actions otherwise', () => {
    expect(parsePaletteQuery(' lettres ')).toEqual({ mode: 'pages', text: 'lettres' });
    expect(parsePaletteQuery('mail@george')).toEqual({ mode: 'pages', text: 'mail@george' });
  });
});
