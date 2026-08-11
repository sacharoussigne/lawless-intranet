export type AppFeatureKey = 'bank';

export type AppSettingsDTO = {
  shelterName: string;
  featureBankEnabled: boolean;
};

export const APP_SETTINGS_DEFAULTS: AppSettingsDTO = {
  shelterName: 'Refuge',
  featureBankEnabled: true,
};

export function normalizeAppSettings(
  settings: Partial<AppSettingsDTO>,
): AppSettingsDTO {
  return { ...APP_SETTINGS_DEFAULTS, ...settings };
}

export function appSettingsCacheTag(shelterId: string): string {
  return `app-settings-${shelterId}`;
}

export const APP_FEATURE_DISABLED_MESSAGE =
  'Cette fonctionnalité est désactivée pour ce refuge.';

export function isAppFeatureEnabled(
  settings: AppSettingsDTO,
  feature: AppFeatureKey,
): boolean {
  switch (feature) {
    case 'bank':
      return settings.featureBankEnabled;
    default: {
      const _exhaustive: never = feature;
      return _exhaustive;
    }
  }
}

export function shelterSiteTitle(settings: AppSettingsDTO): string {
  const name = settings.shelterName.trim() || APP_SETTINGS_DEFAULTS.shelterName;
  return `Refuge ${name}`;
}
