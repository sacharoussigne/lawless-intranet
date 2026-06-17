export type AppFeatureKey =
  | 'stock'
  | 'bank'
  | 'orders'
  | 'search'
  | 'mails'
  | 'payroll'
  | 'weeklyDispensaryActivity'
  | 'agenda'
  | 'cabinet';

export type AppSettingsDTO = {
  dispensaryName: string;
  featureStockEnabled: boolean;
  featureBankEnabled: boolean;
  featureOrdersEnabled: boolean;
  featureSearchEnabled: boolean;
  featureMailsEnabled: boolean;
  featurePayrollEnabled: boolean;
  featureWeeklyDispensaryActivityEnabled: boolean;
  featureAgendaEnabled: boolean;
  featureCabinetEnabled: boolean;
  weeklyActivityChestDaysVisible: boolean;
  weeklyActivityPresenceDaysVisible: boolean;
  weeklyActivityPatientsVisible: boolean;
  weeklyActivitySherifsVisible: boolean;
  weeklyActivityInfusionsVisible: boolean;
  weeklyActivityPoppyMilkVisible: boolean;
};

export const APP_SETTINGS_DEFAULTS: AppSettingsDTO = {
  dispensaryName: 'Saint-Denis',
  featureStockEnabled: true,
  featureBankEnabled: true,
  featureOrdersEnabled: true,
  featureSearchEnabled: true,
  featureMailsEnabled: true,
  featurePayrollEnabled: true,
  featureWeeklyDispensaryActivityEnabled: true,
  featureAgendaEnabled: true,
  featureCabinetEnabled: true,
  weeklyActivityChestDaysVisible: true,
  weeklyActivityPresenceDaysVisible: true,
  weeklyActivityPatientsVisible: true,
  weeklyActivitySherifsVisible: true,
  weeklyActivityInfusionsVisible: true,
  weeklyActivityPoppyMilkVisible: true,
};

export function appSettingsCacheTag(dispensaryId: string): string {
  return `app-settings-${dispensaryId}`;
}

export const APP_FEATURE_DISABLED_MESSAGE =
  'Cette fonctionnalité est désactivée pour ce dispensaire.';

export function isAppFeatureEnabled(
  settings: AppSettingsDTO,
  feature: AppFeatureKey,
): boolean {
  switch (feature) {
    case 'stock':
      return settings.featureStockEnabled;
    case 'bank':
      return settings.featureBankEnabled;
    case 'orders':
      return settings.featureOrdersEnabled;
    case 'search':
      return settings.featureSearchEnabled;
    case 'mails':
      return settings.featureMailsEnabled;
    case 'payroll':
      return settings.featurePayrollEnabled;
    case 'weeklyDispensaryActivity':
      return settings.featureWeeklyDispensaryActivityEnabled;
    case 'agenda':
      return settings.featureAgendaEnabled;
    case 'cabinet':
      return settings.featureCabinetEnabled ?? APP_SETTINGS_DEFAULTS.featureCabinetEnabled;
    default: {
      const _exhaustive: never = feature;
      return _exhaustive;
    }
  }
}

export function dispensarySiteTitle(settings: AppSettingsDTO): string {
  const name =
    settings.dispensaryName.trim() || APP_SETTINGS_DEFAULTS.dispensaryName;
  return `Dispensaire ${name}`;
}
