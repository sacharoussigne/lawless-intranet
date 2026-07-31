'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Permissions, PermissionsContextType, AccessibleDispensary } from '@/types/permissions';
import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import { APP_SETTINGS_DEFAULTS, normalizeAppSettings } from '@/lib/appSettingsShared';
import { tenantRoutes } from '@/types/routes';

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  userRole: null,
  loading: false,
  appSettings: APP_SETTINGS_DEFAULTS,
  dispensarySlug: null,
  dispensaryId: null,
  accessibleDispensaries: [],
  agendaModuleAccess: false,
  accessibleAgendaIds: [],
  cabinetModuleAccess: false,
  accessibleCabinetIds: [],
  hasAccessibleChests: false,
});

interface PermissionsProviderProps {
  children: ReactNode;
  initialPermissions: Permissions | null;
  initialRole: string | null;
  initialAppSettings: AppSettingsDTO;
  dispensarySlug?: string | null;
  dispensaryId?: string | null;
  accessibleDispensaries?: AccessibleDispensary[];
  agendaModuleAccess?: boolean;
  accessibleAgendaIds?: string[];
  cabinetModuleAccess?: boolean;
  accessibleCabinetIds?: string[];
  hasAccessibleChests?: boolean;
}

export function PermissionsProvider({
  children,
  initialPermissions,
  initialRole,
  initialAppSettings,
  dispensarySlug = null,
  dispensaryId = null,
  accessibleDispensaries = [],
  agendaModuleAccess = false,
  accessibleAgendaIds = [],
  cabinetModuleAccess = false,
  accessibleCabinetIds = [],
  hasAccessibleChests = false,
}: PermissionsProviderProps) {
  return (
    <PermissionsContext.Provider
      value={{
        permissions: initialPermissions,
        userRole: initialRole,
        loading: false,
        appSettings: normalizeAppSettings(initialAppSettings),
        dispensarySlug,
        dispensaryId,
        accessibleDispensaries,
        agendaModuleAccess,
        accessibleAgendaIds,
        cabinetModuleAccess,
        accessibleCabinetIds,
        hasAccessibleChests,
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
  const { dispensarySlug } = usePermissions();
  if (!dispensarySlug) {
    throw new Error('useTenantRoutes requires an active dispensary context');
  }
  return tenantRoutes(dispensarySlug);
}

export function useRequiredDispensarySlug(): string {
  const { dispensarySlug } = usePermissions();
  if (!dispensarySlug) {
    throw new Error('useRequiredDispensarySlug requires an active dispensary context');
  }
  return dispensarySlug;
}
