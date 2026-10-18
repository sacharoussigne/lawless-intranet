import type { BusinessType } from '@prisma/client';
import { APP_FEATURE_KEYS, type AppFeatureKey } from '@/lib/appFeatures';
import { DEFAULT_BUSINESS_TYPE, isModuleAllowedForType } from '@/lib/businessTypes';

export { APP_FEATURE_KEYS, type AppFeatureKey };

export type AppSettingsDTO = {
  /** Kind of the business (not a setting: read from the business, decides which modules exist). */
  businessType: BusinessType;
  businessName: string;
  featureStockEnabled: boolean;
  featureBankEnabled: boolean;
  featureOrdersEnabled: boolean;
  featureSearchEnabled: boolean;
  featureMailsEnabled: boolean;
  featurePayrollEnabled: boolean;
  featureWeeklyDispensaryActivityEnabled: boolean;
  featureAgendaEnabled: boolean;
  featureCabinetEnabled: boolean;
  featureSalesEnabled: boolean;
  featureMediaEnabled: boolean;
  weeklyActivityChestDaysVisible: boolean;
  weeklyActivityPresenceDaysVisible: boolean;
  weeklyActivityPatientsVisible: boolean;
  weeklyActivitySherifsVisible: boolean;
  weeklyActivityInfusionsVisible: boolean;
  weeklyActivityPoppyMilkVisible: boolean;
};

export const APP_SETTINGS_DEFAULTS: AppSettingsDTO = {
  businessType: DEFAULT_BUSINESS_TYPE,
  businessName: 'Saint-Denis',
  featureStockEnabled: true,
  featureBankEnabled: true,
  featureOrdersEnabled: true,
  featureSearchEnabled: true,
  featureMailsEnabled: true,
  featurePayrollEnabled: true,
  featureWeeklyDispensaryActivityEnabled: true,
  featureAgendaEnabled: true,
  featureCabinetEnabled: true,
  featureSalesEnabled: true,
  featureMediaEnabled: true,
  weeklyActivityChestDaysVisible: true,
  weeklyActivityPresenceDaysVisible: true,
  weeklyActivityPatientsVisible: true,
  weeklyActivitySherifsVisible: true,
  weeklyActivityInfusionsVisible: true,
  weeklyActivityPoppyMilkVisible: true,
};

/** Settings flag behind each module. */
const FEATURE_SETTING: Record<AppFeatureKey, keyof AppSettingsDTO & `feature${string}Enabled`> = {
  stock: 'featureStockEnabled',
  bank: 'featureBankEnabled',
  orders: 'featureOrdersEnabled',
  search: 'featureSearchEnabled',
  mails: 'featureMailsEnabled',
  payroll: 'featurePayrollEnabled',
  weeklyDispensaryActivity: 'featureWeeklyDispensaryActivityEnabled',
  agenda: 'featureAgendaEnabled',
  cabinet: 'featureCabinetEnabled',
  sales: 'featureSalesEnabled',
  media: 'featureMediaEnabled',
};

/**
 * Fills the defaults and turns off the modules the business type does not offer,
 * so every `feature*Enabled` read (navigation, pages, guards) respects the type.
 */
export function normalizeAppSettings(
  settings: Partial<AppSettingsDTO>,
): AppSettingsDTO {
  const merged: AppSettingsDTO = { ...APP_SETTINGS_DEFAULTS, ...settings };
  for (const feature of APP_FEATURE_KEYS) {
    if (!isModuleAllowedForType(merged.businessType, feature)) {
      merged[FEATURE_SETTING[feature]] = false;
    }
  }
  return merged;
}

export function appSettingsCacheTag(businessId: string): string {
  return `app-settings-${businessId}`;
}

export const APP_FEATURE_DISABLED_MESSAGE =
  'Cette fonctionnalité est désactivée pour ce dispensaire.';

export function isAppFeatureEnabled(
  settings: AppSettingsDTO,
  feature: AppFeatureKey,
): boolean {
  if (!isModuleAllowedForType(settings.businessType, feature)) return false;
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
    case 'sales':
      return settings.featureSalesEnabled ?? APP_SETTINGS_DEFAULTS.featureSalesEnabled;
    case 'media':
      return settings.featureMediaEnabled ?? APP_SETTINGS_DEFAULTS.featureMediaEnabled;
    default: {
      const _exhaustive: never = feature;
      return _exhaustive;
    }
  }
}

export function businessSiteTitle(settings: AppSettingsDTO): string {
  const name =
    settings.businessName.trim() || APP_SETTINGS_DEFAULTS.businessName;
  return `Dispensaire ${name}`;
}
