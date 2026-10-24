/** Tabs of the settings page; shared by the server page and its client component. */
export const BUSINESS_SETTINGS_TABS = ['general', 'members', 'permissions', 'salaries'] as const;
export type BusinessSettingsTab = (typeof BUSINESS_SETTINGS_TABS)[number];

export function isBusinessSettingsTab(tab: string): tab is BusinessSettingsTab {
  return BUSINESS_SETTINGS_TABS.includes(tab as BusinessSettingsTab);
}
