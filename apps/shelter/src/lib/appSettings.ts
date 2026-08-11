import { unstable_cache } from 'next/cache';
import prisma from '@/lib/prisma';
import {
  APP_SETTINGS_DEFAULTS,
  APP_FEATURE_DISABLED_MESSAGE,
  appSettingsCacheTag,
  isAppFeatureEnabled,
  normalizeAppSettings,
  type AppFeatureKey,
  type AppSettingsDTO,
} from '@/lib/appSettingsShared';

export type { AppFeatureKey, AppSettingsDTO } from '@/lib/appSettingsShared';
export {
  APP_SETTINGS_DEFAULTS,
  APP_FEATURE_DISABLED_MESSAGE,
  appSettingsCacheTag,
  isAppFeatureEnabled,
  normalizeAppSettings,
  shelterSiteTitle,
} from '@/lib/appSettingsShared';

function mapFromDb(row: {
  shelterName: string;
  featureBankEnabled: boolean;
}): AppSettingsDTO {
  return {
    shelterName: row.shelterName?.trim() || APP_SETTINGS_DEFAULTS.shelterName,
    featureBankEnabled: row.featureBankEnabled,
  };
}

export async function loadAppSettingsFromDb(shelterId: string): Promise<AppSettingsDTO> {
  try {
    const row = await prisma.appSettings.findUnique({
      where: { shelterId },
    });
    if (!row) {
      return normalizeAppSettings(APP_SETTINGS_DEFAULTS);
    }
    return normalizeAppSettings(mapFromDb(row));
  } catch {
    return normalizeAppSettings(APP_SETTINGS_DEFAULTS);
  }
}

export function getAppSettings(shelterId: string) {
  return unstable_cache(
    () => loadAppSettingsFromDb(shelterId),
    ['app-settings', shelterId, 'v1'],
    {
      tags: [appSettingsCacheTag(shelterId)],
      revalidate: 86400,
    },
  )();
}

export async function getAppFeatureActionBlock(
  shelterId: string,
  feature: AppFeatureKey,
): Promise<{ status: 403; error: string } | null> {
  const settings = await getAppSettings(shelterId);
  if (isAppFeatureEnabled(settings, feature)) {
    return null;
  }
  return { status: 403, error: APP_FEATURE_DISABLED_MESSAGE };
}
