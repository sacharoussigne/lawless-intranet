/** Modules a business can enable (AppSettings `feature*Enabled`). Own file: imported by lib/businessTypes and lib/appSettingsShared. */
export const APP_FEATURE_KEYS = [
  'stock',
  'bank',
  'orders',
  'search',
  'mails',
  'payroll',
  'weeklyActivity',
  'agenda',
  'cabinet',
  'sales',
  'media',
] as const;

export type AppFeatureKey = (typeof APP_FEATURE_KEYS)[number];
