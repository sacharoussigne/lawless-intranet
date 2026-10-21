import { getCompanies, getCompaniesForSelect } from '@/app/_actions/companies';
import { getCompanyGroups, getCompanyGroupsForSelect } from '@/app/_actions/companyGroups';
import CompaniesManagementPageClient from './CompaniesManagementPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function CompaniesContent({
  businessSlug,
  initialTab,
}: {
  businessSlug: string;
  initialTab: 'companies' | 'groups';
}) {
  const [companiesResult, companyGroupsResult, companiesForSelectResult, companyGroupsForSelectResult] =
    await Promise.all([
      getCompanies(businessSlug),
      getCompanyGroups(businessSlug),
      getCompaniesForSelect(businessSlug),
      getCompanyGroupsForSelect(businessSlug),
    ]);

  const companies = getDataOrThrow(companiesResult, 'Erreur lors du chargement des entreprises');
  const companyGroups = getDataOrThrow(
    companyGroupsResult,
    'Erreur lors du chargement des groupes d\'entreprises',
  );
  const companiesForSelect = getDataOrThrow(
    companiesForSelectResult,
    'Erreur lors du chargement des entreprises',
  );
  const companyGroupsForSelect = getDataOrThrow(
    companyGroupsForSelectResult,
    'Erreur lors du chargement des groupes d\'entreprises',
  );

  return (
    <CompaniesManagementPageClient
      initialTab={initialTab}
      initialCompanies={companies}
      initialCompanyGroups={companyGroups}
      initialCompaniesForSelect={companiesForSelect}
      initialCompanyGroupsForSelect={companyGroupsForSelect}
    />
  );
}

export default async function CompaniesPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { businessSlug } = await params;
  const { tab } = await searchParams;
  const initialTab = tab === 'groups' ? 'groups' : 'companies';

  return (
    <SuspenseLoader>
      <CompaniesContent businessSlug={businessSlug} initialTab={initialTab} />
    </SuspenseLoader>
  );
}
