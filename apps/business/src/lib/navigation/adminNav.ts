import type { Icon } from '@tabler/icons-react';
import { IconCalendar, IconMailbox, IconReplace, IconSettings, IconStethoscope } from '@tabler/icons-react';
import { type AppSettingsDTO, isAppFeatureEnabled } from '@/lib/appSettingsShared';
import type { tenantRoutes } from '@/types/routes';

export type AdminNavItem = {
  id: 'agendas' | 'cabinets' | 'letterBoxes' | 'overwriteStock' | 'settings';
  label: string;
  description: string;
  href: string;
  icon: Icon;
};

/** Admin tools of a business (admin hub, command palette), for its enabled modules. Admins only. */
export function getAdminNavItems(t: ReturnType<typeof tenantRoutes>, appSettings: AppSettingsDTO): AdminNavItem[] {
  const items: (AdminNavItem & { visible: boolean })[] = [
    {
      id: 'agendas',
      label: 'Agendas',
      description: 'Créez les agendas partagés et choisissez qui peut les voir ou les modifier.',
      href: t.admin.agendas,
      icon: IconCalendar,
      visible: appSettings.featureAgendaEnabled,
    },
    {
      id: 'cabinets',
      label: 'Cabinets',
      description: 'Créez les cabinets et gérez leurs membres.',
      href: t.admin.cabinets,
      icon: IconStethoscope,
      visible: isAppFeatureEnabled(appSettings, 'cabinet'),
    },
    {
      id: 'letterBoxes',
      label: 'Boîtes aux lettres',
      description: 'Ouvrez une boîte aux lettres pour une personne et choisissez ses propriétaires.',
      href: t.admin.letterBoxes,
      icon: IconMailbox,
      visible: isAppFeatureEnabled(appSettings, 'letters'),
    },
    {
      id: 'overwriteStock',
      label: 'Écraser les stocks',
      description: 'Remplacez les quantités du stock par un inventaire complet.',
      href: t.admin.overwriteStock,
      icon: IconReplace,
      visible: appSettings.featureStockEnabled,
    },
    {
      id: 'settings',
      label: 'Paramètres du dispensaire',
      description: 'Identité, modules, membres, permissions et salaires.',
      href: t.admin.settings,
      icon: IconSettings,
      visible: true,
    },
  ];
  return items.filter((item) => item.visible).map(({ visible: _visible, ...item }) => item);
}
