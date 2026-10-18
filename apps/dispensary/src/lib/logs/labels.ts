import type { LogFeature, LogKind, LogLevel, LogOutcome, LogSource } from './types';

/** French labels of the log page filters and badges. */
export const LOG_FEATURE_LABELS: Record<LogFeature, string> = {
  weeklyActivity: 'Activité hebdo',
  payroll: 'Paie',
  stock: 'Stock',
  bank: 'Banque',
  orders: 'Commandes',
  sales: 'Ventes',
  search: 'Recherche',
  mails: 'Courriers',
  agenda: 'Agenda',
  cabinet: 'Cabinet',
  media: 'Médiathèque',
  management: 'Gestion',
  settings: 'Réglages',
  account: 'Compte',
  platform: 'Plateforme',
  unknown: 'Inconnue',
};

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  INFO: 'Info',
  WARN: 'Avertissement',
  ERROR: 'Erreur',
};

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  ACTION: 'Action',
  ERROR: 'Erreur serveur',
  BOT_REQUEST: 'Requête bot',
};

export const LOG_SOURCE_LABELS: Record<LogSource, string> = {
  INTRANET: 'Intranet',
  DISCORD_BOT: 'Bot Discord',
  SYSTEM: 'Système',
};

export const LOG_OUTCOME_LABELS: Record<LogOutcome, string> = {
  success: 'Réussi',
  noop: 'Rien à faire',
  denied: 'Refusé',
  invalid: 'Invalide',
  failure: 'Échec',
};

export function toSelectData<K extends string>(labels: Record<K, string>) {
  return (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
}
