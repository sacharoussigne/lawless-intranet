'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Container, Tabs } from '@mantine/core';
import { IconBuildingSkyscraper, IconUsersGroup } from '@tabler/icons-react';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { CompaniesTabPanel } from './CompaniesTabPanel';
import { CompanyGroupsTabPanel } from '../companygroups/CompanyGroupsTabPanel';
import type { CompanyWithRelations, CompanySelect } from '@/types/companies';
import type { CompanyGroupWithRelations } from '@/types/companyGroups';
import type { CompanyGroupSelect } from '@/types/items';

const validTabs = ['companies', 'groups'] as const;
type CompaniesManagementTab = (typeof validTabs)[number];

interface CompaniesManagementPageClientProps {
  initialTab: CompaniesManagementTab;
  initialCompanies: CompanyWithRelations[];
  initialCompanyGroups: CompanyGroupWithRelations[];
  initialCompaniesForSelect: CompanySelect[];
  initialCompanyGroupsForSelect: CompanyGroupSelect[];
}

export default function CompaniesManagementPageClient({
  initialTab,
  initialCompanies,
  initialCompanyGroups,
  initialCompaniesForSelect,
  initialCompanyGroupsForSelect,
}: CompaniesManagementPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabFromUrl = searchParams.get('tab');
  const resolvedTab: CompaniesManagementTab =
    tabFromUrl && validTabs.includes(tabFromUrl as CompaniesManagementTab)
      ? (tabFromUrl as CompaniesManagementTab)
      : initialTab;
  const [activeTab, setActiveTab] = useState<CompaniesManagementTab>(resolvedTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab as CompaniesManagementTab)) {
      setActiveTab(tab as CompaniesManagementTab);
    } else if (!tab) {
      setActiveTab('companies');
    }
  }, [searchParams]);

  const handleTabChange = (value: string | null) => {
    if (!value || !validTabs.includes(value as CompaniesManagementTab)) return;
    const tab = value as CompaniesManagementTab;
    setActiveTab(tab);
    if (tab === 'companies') {
      router.push(pathname, { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Entreprises"
        description="Référentiel des entreprises partenaires et regroupements par structure."
      />

      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="companies" leftSection={<IconBuildingSkyscraper size={16} />}>
            Entreprises
          </Tabs.Tab>
          <Tabs.Tab value="groups" leftSection={<IconUsersGroup size={16} />}>
            Groupes
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="companies" pt="xl">
          <CompaniesTabPanel
            initialCompanies={initialCompanies}
            initialCompanyGroups={initialCompanyGroupsForSelect}
          />
        </Tabs.Panel>

        <Tabs.Panel value="groups" pt="xl">
          <CompanyGroupsTabPanel
            initialCompanyGroups={initialCompanyGroups}
            initialCompanies={initialCompaniesForSelect}
          />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
