import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import type { ShelterPermissionsObject } from '@/lib/shelter/permissionsCatalog';

export type Permissions = ShelterPermissionsObject;

export type AccessibleShelter = {
  id: string;
  slug: string;
  name: string;
};

export interface PermissionsContextType {
  permissions: Permissions | null;
  userRole: string | null;
  loading: boolean;
  appSettings: AppSettingsDTO;
  shelterSlug: string | null;
  shelterId: string | null;
  accessibleShelters: AccessibleShelter[];
}
