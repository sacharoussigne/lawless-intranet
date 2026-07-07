'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  createDefaultDisplaySettings,
  type CabinetDisplaySettings,
} from '@/lib/cabinet/displaySettings';

const CabinetDisplaySettingsContext = createContext<CabinetDisplaySettings>(
  createDefaultDisplaySettings(),
);

export function CabinetDisplaySettingsProvider({
  settings,
  children,
}: {
  settings: CabinetDisplaySettings;
  children: ReactNode;
}) {
  return (
    <CabinetDisplaySettingsContext.Provider value={settings}>
      {children}
    </CabinetDisplaySettingsContext.Provider>
  );
}

export function useCabinetDisplaySettings(): CabinetDisplaySettings {
  return useContext(CabinetDisplaySettingsContext);
}
