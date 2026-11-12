import type { Icon } from '@tabler/icons-react';
import {
  IconBuildingStore,
  IconCalendarEvent,
  IconCash,
  IconChecklist,
  IconClockHour4,
  IconHome,
  IconListDetails,
  IconMailPlus,
  IconPhoto,
  IconPlus,
  IconReportMoney,
  IconSettings,
  IconShieldCog,
  IconTools,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import { isAppFeatureEnabled } from '@/lib/appSettingsShared';
import { normalizeString } from '@/lib/string/normalizeString';
import { routes } from '@/types/routes';
import { getAdminNavItems } from './adminNav';
import { type EmployeeNavContext, getEmployeeNavItems, getEmployeeSectionTabs } from './employeeNav';
import { getManagementNavItems } from './managementNav';

/** `?action=` read by a page to open one of its modals (useActionParam). */
export const PAGE_ACTIONS = { createOrder: 'create', hoursRecap: 'recap', newSale: 'sale' } as const;

export type CommandEntry = {
  id: string;
  group: 'page' | 'action';
  label: string;
  /** Where it lives (« Activité », « Gestion »…), shown next to the label. */
  section?: string;
  /** Other words that find it (« paie » → Salaires). */
  keywords: string[];
  href: string;
  icon: Icon;
};

export type CommandPaletteContext = EmployeeNavContext & {
  agendaModuleAccess?: boolean;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
};

const KEYWORDS: Record<string, string[]> = {
  stock: ['stocks', 'inventaire', 'coffres'],
  inventory: ['stock', 'coffres'],
  movements: ['historique', 'stock'],
  statistics: ['stats', 'stock'],
  orders: ['commande', 'achats'],
  bank: ['argent', 'compte', 'transactions'],
  cabinet: ['patients', 'consultations', 'medecin'],
  letters: ['courrier', 'lettre', 'boite aux lettres', 'correspondants'],
  activity: ['heures', 'hebdo'],
  weeklyActivity: ['heures', 'hebdo', 'semaine', 'activite'],
  payroll: ['paie', 'salaire', 'rapport'],
  sales: ['vente', 'caisse'],
  mails: ['courrier', 'templates', 'modeles'],
  search: ['objets', 'trouver'],
  agenda: ['calendrier', 'evenements', 'rdv'],
  tasks: ['todo', 'taches'],
  media: ['images', 'photos', 'fichiers', 'mediatheque'],
  people: ['employes', 'membres', 'discord'],
  items: ['objets', 'catalogue'],
  companies: ['partenaires', 'entreprises'],
};

const withSection = (label: string, section?: string) => (section ? `${section} › ${label}` : label);

/** Pages and quick actions the user can reach, from the same registries as the menus (rights and modules). */
export function getCommandPaletteEntries(ctx: CommandPaletteContext): CommandEntry[] {
  const { t, appSettings, permissions } = ctx;
  const entries: CommandEntry[] = [];
  const page = (id: string, label: string, href: string, icon: Icon, section?: string) =>
    entries.push({ id: `page:${section ?? ''}:${id}`, group: 'page', label, section, keywords: KEYWORDS[id] ?? [], href, icon });

  page('home', 'Accueil', t.employee.index, IconHome);

  const nav = getEmployeeNavItems(ctx);
  for (const item of [...nav.primary, ...nav.more, ...(nav.search ? [nav.search] : [])]) {
    if (item.id === 'stock' || item.id === 'activity') continue; // their tabs below
    page(item.id, item.label, item.href, item.icon);
  }
  for (const tab of getEmployeeSectionTabs(ctx, 'stock')) page(tab.id, tab.label, tab.href, tab.icon, 'Stocks');
  for (const tab of getEmployeeSectionTabs(ctx, 'activity')) page(tab.id, tab.label, tab.href, tab.icon, 'Activité');

  if (appSettings.featureAgendaEnabled && ctx.agendaModuleAccess) {
    page('agenda', 'Agenda', t.agenda.index, IconCalendarEvent);
    page('tasks', 'Tâches', t.agenda.tasks, IconChecklist);
  }
  if (appSettings.featureMediaEnabled && permissions?.media.access) page('media', 'Médiathèque', t.media.index, IconPhoto);

  if (permissions?.application.management) {
    page('management', 'Espace gestion', t.management.index, IconTools);
    const management = getManagementNavItems(t, appSettings, permissions);
    for (const item of [...management.primary, ...management.more]) page(item.id, item.label, item.href, item.icon, 'Gestion');
  }

  if (ctx.isAdmin) {
    page('admin', 'Administration', t.admin.index, IconShieldCog);
    for (const item of getAdminNavItems(t, appSettings)) page(item.id, item.label, item.href, item.icon, 'Admin');
  }

  if (ctx.isPlatformAdmin) {
    page('platform', 'Plateforme', routes.platform.index, IconWorld);
    page('businesses', 'Entreprises', routes.platform.businesses, IconBuildingStore, 'Plateforme');
    page('users', 'Comptes utilisateurs', routes.platform.users, IconUsers, 'Plateforme');
    page('logs', 'Logs', routes.platform.logs, IconListDetails, 'Plateforme');
  }

  page('account', 'Paramètres compte', routes.settings.index, IconSettings);

  // Quick actions: same conditions as the button they stand for.
  const action = (id: string, label: string, href: string, icon: Icon, keywords: string[]) =>
    entries.push({ id: `action:${id}`, group: 'action', label, keywords, href, icon });
  if (appSettings.featureOrdersEnabled && permissions?.orders.view && permissions.orders.create) {
    action('createOrder', 'Créer une commande', `${t.orders.index}?action=${PAGE_ACTIONS.createOrder}`, IconPlus, [
      'nouvelle commande',
      'commander',
    ]);
  }
  if (appSettings.featureWeeklyActivityEnabled && permissions?.weeklyActivity.page) {
    action('hoursRecap', 'Récap des heures', `${t.weeklyActivity.index}?action=${PAGE_ACTIONS.hoursRecap}`, IconClockHour4, [
      'recap',
      'horaires',
      'heures',
    ]);
  }
  if (isAppFeatureEnabled(appSettings, 'sales') && permissions?.sales.create) {
    action('newSale', 'Nouvelle vente', `${t.employee.index}?action=${PAGE_ACTIONS.newSale}`, IconCash, ['vendre', 'caisse']);
  }
  if (appSettings.featurePayrollEnabled && permissions?.payrollReports.view && permissions.payrollReports.create) {
    action('newPayroll', 'Nouveau rapport de salaire', t.employee.payrollNew, IconReportMoney, ['paie', 'salaires']);
  }
  if (appSettings.featureMailsEnabled && permissions?.mails.access) {
    action('newMail', 'Nouveau courrier', t.employee.newMail, IconMailPlus, ['ecrire', 'courrier']);
  }

  return entries;
}

/** Display label of an entry (« Activité › Salaires »). */
export function commandEntryTitle(entry: CommandEntry): string {
  return withSection(entry.label, entry.section);
}

/**
 * Entries matching what is typed, ignoring case and accents: every typed word must start a word of
 * the label, section or keywords. Labels starting with the query come first; actions after pages.
 */
export function filterCommandEntries(entries: CommandEntry[], query: string): CommandEntry[] {
  const words = normalizeString(query.trim()).split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return entries;
  const scored = entries.flatMap((entry, index) => {
    const label = normalizeString(entry.label);
    const haystack = normalizeString([entry.label, entry.section ?? '', ...entry.keywords].join(' '));
    const haystackWords = haystack.split(/[\s'’›-]+/).filter(Boolean);
    const matches = words.every((word) => haystackWords.some((candidate) => candidate.startsWith(word)));
    if (!matches) return [];
    const score = label.startsWith(words.join(' ')) ? 0 : label.split(/\s+/).some((w) => w.startsWith(words[0])) ? 1 : 2;
    return [{ entry, score, index }];
  });
  return scored.sort((a, b) => a.score - b.score || a.index - b.index).map(({ entry }) => entry);
}

/** « @ » at the start switches the palette to the entity search (server); otherwise pages and actions. */
export function parsePaletteQuery(raw: string): { mode: 'pages' | 'entities'; text: string } {
  const trimmed = raw.trimStart();
  return trimmed.startsWith('@')
    ? { mode: 'entities', text: trimmed.slice(1).trim() }
    : { mode: 'pages', text: raw.trim() };
}

export const PALETTE_ENTITY_MIN_LENGTH = 2;
