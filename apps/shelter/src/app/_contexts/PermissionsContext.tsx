'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Permissions, PermissionsContextType, AccessibleShelter } from '@/types/permissions';
import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import { APP_SETTINGS_DEFAULTS, normalizeAppSettings } from '@/lib/appSettingsShared';
import { tenantRoutes } from '@/types/routes';

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  userRole: null,
  loading: false,
  appSettings: APP_SETTINGS_DEFAULTS,
  shelterSlug: null,
  shelterId: null,
  accessibleShelters: [],
});

interface PermissionsProviderProps {
  children: ReactNode;
  initialPermissions: Permissions | null;
  initialRole: string | null;
  initialAppSettings: AppSettingsDTO;
  shelterSlug?: string | null;
  shelterId?: string | null;
  accessibleShelters?: AccessibleShelter[];
}

export function PermissionsProvider({
  children,
  initialPermissions,
  initialRole,
  initialAppSettings,
  shelterSlug = null,
  shelterId = null,
  accessibleShelters = [],
}: PermissionsProviderProps) {
  return (
    <PermissionsContext.Provider
      value={{
        permissions: initialPermissions,
        userRole: initialRole,
        loading: false,
        appSettings: normalizeAppSettings(initialAppSettings),
        shelterSlug,
        shelterId,
        accessibleShelters,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

export function useTenantRoutes() {
  const { shelterSlug } = usePermissions();
  if (!shelterSlug) {
    throw new Error('useTenantRoutes requires an active shelter context');
  }
  return tenantRoutes(shelterSlug);
}

export function useRequiredShelterSlug(): string {
  const { shelterSlug } = usePermissions();
  if (!shelterSlug) {
    throw new Error('useRequiredShelterSlug requires an active shelter context');
  }
  return shelterSlug;
}
