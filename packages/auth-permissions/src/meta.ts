import {
  listCatalogPermissionKeys,
  parsePermissionKey,
  type PermissionKey,
} from "./catalog";

/** French descriptions for each catalog permission key. */
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "stock:view": "Consulter les stocks et coffres accessibles",
  "stock:create": "Ajouter des objets / stocks",
  "stock:update": "Modifier les stocks (ajustements, transferts, etc.)",
  "stock:delete": "Supprimer des objets / stocks",
  "stock:craft-read": "Consulter les recettes de craft",
  "stock:craft-write": "Créer / modifier les recettes de craft",
  "stock:hide": "Masquer des objets dans l’interface stock",
  "orders:view": "Consulter les commandes",
  "orders:create": "Créer des commandes",
  "orders:update": "Modifier des commandes",
  "orders:delete": "Supprimer des commandes",
  "search:access": "Accéder à la recherche (utilisateurs, etc.)",
  "bank:access": "Accéder au module banque",
  "application:access": "Accéder à l’application du dispensaire",
  "application:management": "Accéder à la zone management (coffres, etc.)",
  "mails:access": "Accéder aux courriers / templates",
  "payroll_reports:view": "Consulter les rapports de paie",
  "payroll_reports:create": "Créer / supprimer des rapports de paie",
  "weekly_dispensary_activity:view": "Consulter l’activité hebdomadaire",
  "weekly_dispensary_activity:edit_own": "Modifier uniquement ses propres lignes d’activité",
  "weekly_dispensary_activity:edit_all": "Modifier toutes les lignes d’activité",
  "sales:create": "Enregistrer une vente",
  "sales:cancel": "Annuler une vente",
  "sales:view": "Consulter ses ventes",
  "sales:view_all": "Consulter toutes les ventes du dispensaire",
  "stock_statistics:view": "Consulter les statistiques et mouvements de stock",
};

export type CatalogPermissionEntry = {
  key: PermissionKey;
  resource: string;
  action: string;
  description: string;
};

export function listCatalogPermissionEntries(): CatalogPermissionEntry[] {
  return listCatalogPermissionKeys()
    .map((key) => {
      const parsed = parsePermissionKey(key);
      if (!parsed) {
        return null;
      }
      return {
        key,
        resource: parsed.resource,
        action: parsed.action,
        description: PERMISSION_DESCRIPTIONS[key] ?? "",
      };
    })
    .filter((entry): entry is CatalogPermissionEntry => entry != null)
    .sort((a, b) => a.key.localeCompare(b.key));
}
