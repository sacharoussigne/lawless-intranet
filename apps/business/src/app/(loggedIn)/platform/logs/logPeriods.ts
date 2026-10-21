export const LOG_PERIODS = [
  { value: '1h', label: 'Dernière heure', hours: 1 },
  { value: '24h', label: '24 dernières heures', hours: 24 },
  { value: '7d', label: '7 derniers jours', hours: 24 * 7 },
  { value: '30d', label: '30 derniers jours', hours: 24 * 30 },
  { value: '90d', label: '90 derniers jours (tout)', hours: 24 * 90 },
] as const;

export type LogPeriod = (typeof LOG_PERIODS)[number]['value'];

export const DEFAULT_LOG_PERIOD: LogPeriod = '7d';

export function logPeriodStart(period: LogPeriod, now = Date.now()): Date {
  const hours = LOG_PERIODS.find((item) => item.value === period)?.hours ?? 24 * 7;
  return new Date(now - hours * 60 * 60 * 1000);
}
