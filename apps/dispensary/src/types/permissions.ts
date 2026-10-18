import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import type { PermissionsObject } from '@lawless-intranet/auth-permissions';

export type Permissions = PermissionsObject;

export type AccessibleBusiness = {
  id: string;
  slug: string;
  name: string;
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
