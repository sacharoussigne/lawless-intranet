import { listDispensaryWeeklyActivities } from '@/app/_actions/dispensaryWeeklyActivity';
import { tenantRoutes } from '@/types/routes';
import { Container, SimpleGrid, Text } from '@mantine/core';
import {
  IconAbacus,
  IconArchive,
  IconCalendarEvent,
  IconCalendarWeek,
  IconCashRegister,
  IconHistory,
  IconMail,
  IconNotebook,
  IconReportMoney,
  IconStethoscope,
} from '@tabler/icons-react';
import { getAuthSession } from '@/lib/authSession';
import { calculatePermissions } from '@/lib/auth/calculatePermissions';
import { checkRolePermission } from '@lawless-intranet/auth-permissions';
import { dispensarySiteTitle, getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import type { AuthSession } from '@/types/session';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { userHasAnyAgendaAccess } from '@/lib/agenda/access';
import { userHasAnyCabinetAccess } from '@/lib/cabinet/access';
import { ModuleCard, type ModuleCardProps } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { getBankWeekBounds } from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import {
  getDiscordAccountIdForUser,
  resolveDiscordDisplayName,
} from '@/lib/dispensaryWeeklyActivity/resolveDisplayName';
import prisma from '@/lib/prisma';
import { getDataOrThrow } from '@/lib/response';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[dispensarySlug]/weekly-activity/hooks/useWeeklyActivityQueries';
import { EmployeeWeeklyDashboard } from './EmployeeWeeklyDashboard';

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  const effectiveRole = await getEffectiveRoleForDispensary(session as AuthSession | null, dispensary.id);
  const permissions = calculatePermissions(effectiveRole);
  const appSettings = await getAppSettings(dispensary.id);
  const t = tenantRoutes(dispensarySlug);
  const siteTitle = dispensarySiteTitle(appSettings);
  const userId = session?.user?.id ?? '';
  const agendaModuleAccess = userId
    ? await userHasAnyAgendaAccess(
        dispensary.id,
        userId,
        session!.user.role,
        effectiveRole,
      )
    : false;
  const cabinetModuleAccess = userId
    ? await userHasAnyCabinetAccess(dispensary.id, userId)
    : false;

  const weeklyFeatureEnabled = appSettings.featureWeeklyDispensaryActivityEnabled;
  const canViewWeekly = permissions?.weeklyDispensaryActivity.view ?? false;
  const canEditAll = checkRolePermission(effectiveRole, 'weekly_dispensary_activity', 'edit_all');
  const canEdit =
    canEditAll || checkRolePermission(effectiveRole, 'weekly_dispensary_activity', 'edit_own');

  const employeeSections: (ModuleCardProps & { hasAccess: boolean })[] = [
    {
      title: 'Stock',
      description:
        'Consultez et gérez le stock des objets disponibles dans les différents coffres.',
      icon: IconArchive,
      href: t.stock.index,
      hasAccess: appSettings.featureStockEnabled && (permissions?.stock.view ?? false),
    },
    {
      title: 'Commandes',
      description: 'Gérez les commandes passées aux entreprises et suivez leur statut.',
      icon: IconNotebook,
      href: t.orders.index,
      hasAccess: appSettings.featureOrdersEnabled && (permissions?.orders.view ?? false),
    },
    {
      title: 'Banque',
      description: 'Suivez les comptes bancaires et les transactions hebdomadaires.',
      icon: IconCashRegister,
      href: t.bank.index,
      hasAccess:
        appSettings.featureBankEnabled && checkRolePermission(effectiveRole, 'bank', 'access'),
    },
    {
      title: 'Courriers',
      description: 'Rédigez et gérez les courriers et modèles.',
      icon: IconMail,
      href: t.employee.mails,
      hasAccess: appSettings.featureMailsEnabled && checkRolePermission(effectiveRole, 'mails', 'access'),
    },
    {
      title: 'Salaires',
      description: 'Consultez les rapports de paie hebdomadaires.',
      icon: IconReportMoney,
      href: t.employee.payroll,
      hasAccess: appSettings.featurePayrollEnabled && (permissions?.payrollReports.view ?? false),
    },
    {
      title: 'Agenda',
      description: 'Calendrier partagé et listes de tâches de l\'organisation.',
      icon: IconCalendarEvent,
      href: t.agenda.index,
      hasAccess: appSettings.featureAgendaEnabled && agendaModuleAccess,
    },
    {
      title: 'Cabinet',
      description: 'Dossiers patients et consultations des cabinets médicaux.',
      icon: IconStethoscope,
      href: t.cabinet.index,
      hasAccess: isAppFeatureEnabled(appSettings, 'cabinet') && cabinetModuleAccess,
    },
    {
      title: 'Activité hebdo',
      description: 'Historique, filtres et détails complets de l’activité.',
      icon: IconCalendarWeek,
      href: t.weeklyActivity.index,
      hasAccess: weeklyFeatureEnabled && canViewWeekly,
    },
    {
      title: 'Stats stock',
      description: 'Visualisez les statistiques de stock.',
      icon: IconAbacus,
      href: t.employee.stockStatistics,
      hasAccess: appSettings.featureStockEnabled && (permissions?.stockStatistics.view ?? false),
    },
    {
      title: 'Historique stock',
      description: 'Consultez et corrigez le journal des mouvements de stock.',
      icon: IconHistory,
      href: t.employee.stockMovements,
      hasAccess: appSettings.featureStockEnabled && (permissions?.stockStatistics.view ?? false),
    },
  ];

  const visibleSections = employeeSections
    .filter((s) => s.hasAccess)
    .map(({ hasAccess: _access, ...section }) => section);

  let initialWeekBounds = {
    periodStart: new Date(),
    periodEnd: new Date(),
  };
  let initialRows: WeeklyActivityListItem[] = [];
  let viewerDiscordId: string | null = null;
  let defaultDisplayName = session?.user?.name ?? 'Moi';

  if (weeklyFeatureEnabled && canViewWeekly && session?.user) {
    const week = getBankWeekBounds(dayjs().tz('Europe/Paris').startOf('day').toDate());
    initialWeekBounds = { periodStart: week.start, periodEnd: week.end };

    const [result, discordId] = await Promise.all([
      listDispensaryWeeklyActivities(dispensarySlug, initialWeekBounds),
      getDiscordAccountIdForUser(prisma, session.user.id),
    ]);
    initialRows = getDataOrThrow(result, 'Erreur lors du chargement de l’activité hebdomadaire');
    viewerDiscordId = discordId;
    defaultDisplayName = discordId
      ? await resolveDiscordDisplayName(prisma, discordId)
      : session.user.name;
  }

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Espace employé"
        description={`Retrouvez ici les outils du quotidien pour le ${siteTitle}.`}
      />

      {weeklyFeatureEnabled && canViewWeekly && (
        <EmployeeWeeklyDashboard
          dispensarySlug={dispensarySlug}
          canEdit={canEdit}
          canEditAll={canEditAll}
          sessionUserId={userId}
          viewerDiscordId={viewerDiscordId}
          defaultDisplayName={defaultDisplayName}
          initialWeekBounds={initialWeekBounds}
          initialRows={initialRows}
        />
      )}

      <hr
        className="disp-section-divider"
        style={{ marginTop: 'var(--mantine-spacing-xl)' }}
      />

      <Text className="disp-display-title" mb="lg">
        Accès aux modules
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {visibleSections.map((section) => (
          <ModuleCard key={section.title} {...section} />
        ))}
      </SimpleGrid>
    </Container>
  );
}
