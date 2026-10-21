'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Permissions, PermissionsContextType, AccessibleBusiness } from '@/types/permissions';
import type { AppSettingsDTO } from '@/lib/appSettingsShared';
import { APP_SETTINGS_DEFAULTS, normalizeAppSettings } from '@/lib/appSettingsShared';
import { tenantRoutes } from '@/types/routes';
import { getBusinessTypeDefinition, type BusinessTypeDefinition } from '@/lib/businessTypes';

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  userRole: null,
  loading: false,
  appSettings: APP_SETTINGS_DEFAULTS,
  businessSlug: null,
  businessId: null,
  accessibleBusinesses: [],
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
  businessSlug?: string | null;
  businessId?: string | null;
  accessibleBusinesses?: AccessibleBusiness[];
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
  businessSlug = null,
  businessId = null,
  accessibleBusinesses = [],
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
        businessSlug,
        businessId,
        accessibleBusinesses,
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
  const { businessSlug } = usePermissions();
  if (!businessSlug) {
    throw new Error('useTenantRoutes requires an active dispensary context');
  }
  return tenantRoutes(businessSlug);
}

export function useRequiredBusinessSlug(): string {
  const { businessSlug } = usePermissions();
  if (!businessSlug) {
    throw new Error('useRequiredBusinessSlug requires an active dispensary context');
  }
  return businessSlug;
}

/** What the kind of the current business offers (modules, roles…): see lib/businessTypes. */
export function useBusinessTypeDefinition(): BusinessTypeDefinition {
  const { appSettings } = usePermissions();
  return getBusinessTypeDefinition(appSettings.businessType);
}
