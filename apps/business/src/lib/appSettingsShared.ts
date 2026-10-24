import type { BusinessType } from '@prisma/client';
import { APP_FEATURE_KEYS, type AppFeatureKey } from '@/lib/appFeatures';
import {
  DEFAULT_BUSINESS_TYPE,
  getBusinessTypeDefinition,
  isModuleAllowedForType,
} from '@/lib/businessTypes';
import { PAYROLL_PATIENT_CARE_USD } from '@/lib/payroll/constants';

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
  featureWeeklyActivityEnabled: boolean;
  featureAgendaEnabled: boolean;
  featureCabinetEnabled: boolean;
  featureSalesEnabled: boolean;
  featureMediaEnabled: boolean;
  weeklyActivityChestDaysVisible: boolean;
  weeklyActivityPresenceDaysVisible: boolean;
  /** Weekly activity counters of the business type: key → enabled (a missing key is enabled). */
  weeklyActivityCounters: Record<string, boolean>;
  /** Paid per patient cared for (payroll), for every salary type. Edited in the Salaires tab. */
  payrollPatientCareUsd: number;
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
  featureWeeklyActivityEnabled: true,
  featureAgendaEnabled: true,
  featureCabinetEnabled: true,
  featureSalesEnabled: true,
  featureMediaEnabled: true,
  weeklyActivityChestDaysVisible: true,
  weeklyActivityPresenceDaysVisible: true,
  weeklyActivityCounters: {},
  payrollPatientCareUsd: PAYROLL_PATIENT_CARE_USD,
};

/** Settings flag behind each module. */
const FEATURE_SETTING: Record<AppFeatureKey, keyof AppSettingsDTO & `feature${string}Enabled`> = {
  stock: 'featureStockEnabled',
  bank: 'featureBankEnabled',
  orders: 'featureOrdersEnabled',
  search: 'featureSearchEnabled',
  mails: 'featureMailsEnabled',
  payroll: 'featurePayrollEnabled',
  weeklyActivity: 'featureWeeklyActivityEnabled',
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
  'Cette fonctionnalité est désactivée pour cette entreprise.';

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
    case 'weeklyActivity':
      return settings.featureWeeklyActivityEnabled;
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
  return `${getBusinessTypeDefinition(settings.businessType).label} ${name}`;
}
