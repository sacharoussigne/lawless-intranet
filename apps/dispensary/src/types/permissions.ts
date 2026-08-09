import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import type { PermissionsObject } from '@lawless-intranet/auth-permissions';

export type Permissions = PermissionsObject;

export type AccessibleDispensary = {
  id: string;
  slug: string;
  name: string;
};

export interface PermissionsContextType {
  permissions: Permissions | null;
  userRole: string | null;
  loading: boolean;
  appSettings: AppSettingsDTO;
  dispensarySlug: string | null;
  dispensaryId: string | null;
  accessibleDispensaries: AccessibleDispensary[];
  agendaModuleAccess: boolean;
  accessibleAgendaIds: string[];
  cabinetModuleAccess: boolean;
  accessibleCabinetIds: string[];
  hasAccessibleChests: boolean;
}
