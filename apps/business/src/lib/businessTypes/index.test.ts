import { describe, expect, it } from 'vitest';
import { applicationPermissionCatalog, flattenRoleMatrix } from '@lawless-intranet/auth-permissions';
import { APP_FEATURE_KEYS } from '@/lib/appFeatures';
import {
  APP_SETTINGS_DEFAULTS,
  isAppFeatureEnabled,
  normalizeAppSettings,
} from '@/lib/appSettingsShared';
import { BUSINESS_MEMBER_ROLES, Role } from '@/types/enum/roles';
import {
  businessTypes,
  isMemberRoleAllowedForType,
  isModuleAllowedForType,
  isResourceAllowedForType,
  type BusinessType,
} from '@/lib/businessTypes';

const TYPES = Object.keys(businessTypes) as BusinessType[];

describe('business types registry', () => {
  it('keeps every module and role of the dispensary', () => {
    for (const feature of APP_FEATURE_KEYS) {
      expect(isModuleAllowedForType('DISPENSARY', feature)).toBe(true);
    }
    for (const role of BUSINESS_MEMBER_ROLES) {
      expect(isMemberRoleAllowedForType('DISPENSARY', role)).toBe(true);
    }
    for (const resource of Object.keys(applicationPermissionCatalog)) {
      expect(isResourceAllowedForType('DISPENSARY', resource)).toBe(true);
    }
  });

  it('refuses unknown roles and resources', () => {
    expect(isMemberRoleAllowedForType('DISPENSARY', Role.USER)).toBe(false);
    expect(isMemberRoleAllowedForType('DISPENSARY', 'barman')).toBe(false);
    expect(isResourceAllowedForType('DISPENSARY', 'unknown')).toBe(false);
  });

  it.each(TYPES)('%s: roles and default permissions stay within the type', (type) => {
    const def = businessTypes[type];
    for (const role of def.memberRoles) {
      expect(BUSINESS_MEMBER_ROLES).toContain(role);
    }
    for (const row of flattenRoleMatrix(def.defaultRoleMatrix)) {
      expect(isResourceAllowedForType(type, row.resource)).toBe(true);
    }
  });
});

describe('normalizeAppSettings', () => {
  it('keeps the flags of the modules the type offers', () => {
    const settings = normalizeAppSettings({ featureCabinetEnabled: false });
    expect(settings.businessType).toBe('DISPENSARY');
    expect(settings.featureCabinetEnabled).toBe(false);
    expect(settings.featureStockEnabled).toBe(true);
    expect(isAppFeatureEnabled(settings, 'cabinet')).toBe(false);
    expect(isAppFeatureEnabled(settings, 'stock')).toBe(true);
  });

  it('fills the defaults', () => {
    expect(normalizeAppSettings({})).toEqual(APP_SETTINGS_DEFAULTS);
  });
});
