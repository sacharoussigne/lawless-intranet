import type { BusinessType } from '@prisma/client';
import {
  DEFAULT_ROLE_MATRIX,
  type ApplicationResource,
  type RoleMatrix,
} from '@lawless-intranet/auth-permissions';
import { APP_FEATURE_KEYS, type AppFeatureKey } from '@/lib/appFeatures';
import { Role, type BusinessMemberRole } from '@/types/enum/roles';

export type { BusinessType } from '@prisma/client';

/** Icon of a weekly activity counter (mapped to a Tabler icon by the UI). */
export type WeeklyCounterIcon = 'patients' | 'sheriffs' | 'infusions' | 'poppyMilk' | 'food' | 'drink';

/** Payroll stat a weekly activity counter fills when the payroll imports the week (lib/payroll/schema). */
export type WeeklyCounterPayrollStat =
  | 'sherifs'
  | 'patients_soignes'
  | 'poppy_milk_offertes'
  | 'infusions_ginseng_offertes';

/** A counter of the weekly activity: one button for the employee, one column in the table. */
export type WeeklyCounterDefinition = {
  /** Stored key (`BusinessWeeklyActivity.counters`, history `counterKey`): never rename. */
  key: string;
  label: string;
  /** Shorter label of the quick action tile (defaults to `label`). */
  shortLabel?: string;
  icon: WeeklyCounterIcon;
  /** Field of the bot API rows and bodies, kept for the existing Discord bots. */
  legacyField?: string;
  payrollStat?: WeeklyCounterPayrollStat;
  /** Its increments mark the open hours of the week recap (e.g. patients cared for). */
  hoursSignal?: boolean;
};

/**
 * Everything that varies with the kind of business (docs/MULTI-BUSINESS.md).
 * Client-safe: no server import.
 */
export type BusinessTypeDefinition = {
  label: string;
  labelPlural: string;
  /** Modules this kind of business can offer: a module is on when allowed here AND enabled in its settings. */
  modules: readonly AppFeatureKey[];
  /** Roles a member can hold, in display order. */
  memberRoles: readonly BusinessMemberRole[];
  /** Seeded when a business has no role permissions yet, and on « reset ». */
  defaultRoleMatrix: RoleMatrix;
  /** Counters of the weekly activity (each can be turned off in the settings). */
  weeklyCounters: readonly WeeklyCounterDefinition[];
};

export const DEFAULT_BUSINESS_TYPE: BusinessType = 'DISPENSARY';

export const businessTypes = {
  DISPENSARY: {
    label: 'Dispensaire',
    labelPlural: 'Dispensaires',
    modules: APP_FEATURE_KEYS,
    memberRoles: [
      Role.ADMIN,
      Role.EMPLOYEE,
      Role.INVENTORY_MANAGER,
      Role.INVENTORY_VIEWER,
      Role.DIRECTION,
      Role.CASH_PREPARER,
    ],
    defaultRoleMatrix: DEFAULT_ROLE_MATRIX,
    weeklyCounters: [
      {
        key: 'patients',
        label: 'Patients',
        icon: 'patients',
        legacyField: 'patientsCount',
        payrollStat: 'patients_soignes',
        hoursSignal: true,
      },
      {
        key: 'sheriffs',
        label: 'Shérifs',
        icon: 'sheriffs',
        legacyField: 'sherifCount',
        payrollStat: 'sherifs',
      },
      {
        key: 'infusions',
        label: 'Infusions',
        shortLabel: 'Infusion',
        icon: 'infusions',
        legacyField: 'infusionsCount',
        payrollStat: 'infusions_ginseng_offertes',
      },
      {
        key: 'poppyMilk',
        label: 'Lait de pavot',
        shortLabel: 'Lait pavot',
        icon: 'poppyMilk',
        legacyField: 'poppyMilkCount',
        payrollStat: 'poppy_milk_offertes',
      },
    ],
  },
} as const satisfies Record<BusinessType, BusinessTypeDefinition>;

export function getBusinessTypeDefinition(type: BusinessType): BusinessTypeDefinition {
  return businessTypes[type] ?? businessTypes[DEFAULT_BUSINESS_TYPE];
}

export function isModuleAllowedForType(type: BusinessType, feature: AppFeatureKey): boolean {
  return getBusinessTypeDefinition(type).modules.includes(feature);
}

export function isMemberRoleAllowedForType(type: BusinessType, role: string): boolean {
  return (getBusinessTypeDefinition(type).memberRoles as readonly string[]).includes(role);
}

/** Module behind each permission resource (null: always offered). */
const RESOURCE_MODULE: Record<ApplicationResource, AppFeatureKey | null> = {
  stock: 'stock',
  orders: 'orders',
  search: 'search',
  bank: 'bank',
  application: null,
  mails: 'mails',
  payroll_reports: 'payroll',
  weekly_activity: 'weeklyActivity',
  sales: 'sales',
  stock_statistics: 'stock',
  media: 'media',
};

/** Permission resources shown for this kind of business (those of its allowed modules). */
export function isResourceAllowedForType(type: BusinessType, resource: string): boolean {
  const feature = RESOURCE_MODULE[resource as ApplicationResource];
  if (feature === undefined) return false;
  return feature === null || isModuleAllowedForType(type, feature);
}
