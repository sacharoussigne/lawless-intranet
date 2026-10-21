import type { BusinessType } from '@prisma/client';
import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import type { PermissionsObject } from '@lawless-intranet/auth-permissions';

export type Permissions = PermissionsObject;

export type AccessibleBusiness = {
  id: string;
  slug: string;
  name: string;
  type: BusinessType;
  /** Where to open it from this host: '' (here) or `proto://host` of its type (lib/business/hosts). */
  origin: string;
};

export interface PermissionsContextType {
  permissions: Permissions | null;
  userRole: string | null;
  loading: boolean;
  appSettings: AppSettingsDTO;
  businessSlug: string | null;
  businessId: string | null;
  accessibleBusinesses: AccessibleBusiness[];
  agendaModuleAccess: boolean;
  accessibleAgendaIds: string[];
  cabinetModuleAccess: boolean;
  accessibleCabinetIds: string[];
  hasAccessibleChests: boolean;
}
