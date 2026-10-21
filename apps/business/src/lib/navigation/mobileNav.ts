import type { Icon } from '@tabler/icons-react';
import { IconCalendarEvent, IconChecklist, IconHome, IconPhoto, IconUserCircle } from '@tabler/icons-react';
import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import type { Permissions } from '@/types/permissions';
import type { tenantRoutes } from '@/types/routes';

/** Phones (Mantine `sm` breakpoint): bottom tab bar instead of the header navigation. */
export const MOBILE_MEDIA_QUERY = '(max-width: 47.99em)';

export type MobileTabId = 'home' | 'agenda' | 'tasks' | 'media' | 'account';

export type MobileTab = {
  id: MobileTabId;
  label: string;
  href: string;
  icon: Icon;
};

export type MobileNavContext = {
  t: ReturnType<typeof tenantRoutes>;
  appSettings: AppSettingsDTO;
  permissions: Permissions | null;
  agendaModuleAccess: boolean;
};

/** Tabs of the installed app: only the screens worth using on a phone. */
export function getMobileTabs({ t, appSettings, permissions, agendaModuleAccess }: MobileNavContext): MobileTab[] {
  const agenda = appSettings.featureAgendaEnabled && agendaModuleAccess;
  const media = appSettings.featureMediaEnabled && permissions?.media.access === true;
  const tabs: (MobileTab | false)[] = [
    { id: 'home', label: 'Accueil', href: t.employee.index, icon: IconHome },
    // Phones open the agenda on the list of upcoming events.
    agenda && { id: 'agenda', label: 'Agenda', href: `${t.agenda.index}?view=agenda`, icon: IconCalendarEvent },
    agenda && { id: 'tasks', label: 'Tâches', href: t.agenda.tasks, icon: IconChecklist },
    media && { id: 'media', label: 'Médiathèque', href: t.media.index, icon: IconPhoto },
    { id: 'account', label: 'Profil', href: t.employee.account, icon: IconUserCircle },
  ];
  return tabs.filter((tab): tab is MobileTab => tab !== false);
}

function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Tab matching the current page; null on pages not linked from the tab bar (stock, bank…). */
export function getActiveMobileTab(pathname: string, t: ReturnType<typeof tenantRoutes>): MobileTabId | null {
  if (pathname === t.employee.index) return 'home';
  if (isUnder(pathname, t.agenda.tasks)) return 'tasks';
  if (isUnder(pathname, t.agenda.index)) return 'agenda';
  if (isUnder(pathname, t.media.index)) return 'media';
  if (isUnder(pathname, t.employee.account)) return 'account';
  return null;
}

const TAB_TITLES: Record<MobileTabId, string> = {
  home: 'Accueil',
  agenda: 'Agenda',
  tasks: 'Tâches',
  media: 'Médiathèque',
  account: 'Profil',
};

/** Title of the compact mobile header: the tab name, or `fallback` (dispensary name) elsewhere. */
export function getMobileSectionTitle(
  pathname: string,
  t: ReturnType<typeof tenantRoutes>,
  fallback: string,
): string {
  const tab = getActiveMobileTab(pathname, t);
  return tab ? TAB_TITLES[tab] : fallback;
}
