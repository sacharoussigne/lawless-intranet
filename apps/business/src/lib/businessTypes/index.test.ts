import { describe, expect, it } from 'vitest';
import { applicationPermissionCatalog, flattenRoleMatrix } from '@lawless-intranet/auth-permissions';
import { APP_FEATURE_KEYS } from '@/lib/appFeatures';
import {
  APP_SETTINGS_DEFAULTS,
  isAppFeatureEnabled,
  normalizeAppSettings,
} from '@/lib/appSettingsShared';
import { BUSINESS_MEMBER_ROLES, Role } from '@/types/enum/roles';
import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/businessDiscordProfile/constants';
import {
  isCashPreparerGrade,
  businessTypes,
  isMemberRoleAllowedForType,
  isModuleAllowedForType,
  isResourceAllowedForType,
  rolesOfGrade,
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
    for (const roles of Object.values(def.gradeRoles)) {
      for (const role of roles) expect(def.memberRoles).toContain(role);
    }
    for (const row of flattenRoleMatrix(def.defaultRoleMatrix)) {
      expect(isResourceAllowedForType(type, row.resource)).toBe(true);
    }
  });
});

describe('rolesOfGrade', () => {
  it('maps every payroll grade, and falls back on employee', () => {
    for (const grade of PAYROLL_EMPLOYEE_ROLES) {
      expect(businessTypes.DISPENSARY.gradeRoles).toHaveProperty([grade]);
    }
    expect(rolesOfGrade('DISPENSARY', 'Directrice')).toEqual([Role.DIRECTION, Role.EMPLOYEE]);
    expect(rolesOfGrade('DISPENSARY', 'Préparateur de caisses')).toEqual([Role.CASH_PREPARER]);
    expect(rolesOfGrade('DISPENSARY', null)).toEqual([Role.EMPLOYEE]);
    expect(rolesOfGrade('DISPENSARY', 'Barman')).toEqual([Role.EMPLOYEE]);
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

describe('isCashPreparerGrade', () => {
  it('lists only grades that the type gives roles to', () => {
    for (const [type, def] of Object.entries(businessTypes)) {
      for (const grade of def.cashPreparerGrades) {
        expect(Object.keys(def.gradeRoles), `${type}: ${grade}`).toContain(grade);
      }
    }
  });

  it('matches the cash preparer grades of the type, trimmed', () => {
    expect(isCashPreparerGrade('DISPENSARY', 'Préparatrice de caisses')).toBe(true);
    expect(isCashPreparerGrade('DISPENSARY', '  Préparateur de caisses ')).toBe(true);
    expect(isCashPreparerGrade('DISPENSARY', 'Médecin')).toBe(false);
    expect(isCashPreparerGrade('DISPENSARY', '')).toBe(false);
    expect(isCashPreparerGrade('DISPENSARY', null)).toBe(false);
  });
});
