'use client';

import { Container } from '@mantine/core';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { getEmployeeSectionTabs, type EmployeeSectionId } from '@/lib/navigation/employeeNav';
import { SectionTabs } from './SectionTabs';

const SECTION_LABELS: Record<EmployeeSectionId, string> = {
  stock: 'Sections du stock',
  activity: 'Sections de l’activité',
};

/** Tabs of an employee section, with the same visibility rules as the header link. */
export function EmployeeSectionTabs({ section }: { section: EmployeeSectionId }) {
  const t = useTenantRoutes();
  const { appSettings, permissions, userRole, cabinetModuleAccess, hasAccessibleChests } = usePermissions();
  const tabs = getEmployeeSectionTabs(
    { t, appSettings, permissions, userRole, cabinetModuleAccess, hasAccessibleChests },
    section,
  );
  if (tabs.length < 2) return null;

  return (
    <Container size="xl" pt="lg">
      <SectionTabs tabs={tabs} label={SECTION_LABELS[section]} />
    </Container>
  );
}
