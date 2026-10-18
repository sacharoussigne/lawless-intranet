import { listBusinessWeeklyActivities } from '@/app/_actions/businessWeeklyActivity';
import { resolveDiscordPersonName } from '@/lib/people/resolveNames';
import { listWeeklySales } from '@/app/_actions/sales';
import { getChestsList } from '@/app/_actions/chests';
import { getOrdersPage } from '@/app/_actions/orders';
import { getOrderLetterTemplateAssignments } from '@/app/_actions/orderLetterTemplateAssignments';
import { Container } from '@mantine/core';
import { getAuthSession } from '@/lib/authSession';
import { calculatePermissionsFromEffective } from '@/lib/auth/calculatePermissions';
import { hasRole, can } from '@lawless-intranet/auth-permissions';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import type { AuthSession } from '@/types/session';
import { getEffectiveRoleForBusiness, requireBusinessFromSlug } from '@/lib/business/context';
import { resolveEffectivePermissionsForBusiness } from '@/lib/business/permissionsResolve';
import { userHasAccessibleChests } from '@/lib/chests/access';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { getBankWeekBounds } from '@/lib/bankWeek';
import dayjs from '@/lib/dayjs';
import {
  getDiscordAccountIdForUser,
} from '@/lib/businessWeeklyActivity/resolveDisplayName';
import prisma from '@/lib/prisma';
import { getDataOrThrow } from '@/lib/response';
import type { WeeklyActivityListItem } from '@/app/(loggedIn)/d/[businessSlug]/employee/(activity)/weekly-activity/hooks/useWeeklyActivityQueries';
import type { WeeklySalesSummary } from '@/app/_actions/sales';
import type { ChestListItem } from '@/types/chests';
import type { OrdersPageResult } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import { Role } from '@/types/enum/roles';
import { defaultActiveOrdersPageFilters } from '@/lib/orders/queryKeys';
import { EmployeeWeeklyOverview } from './EmployeeWeeklyOverview';
import { EmployeeQuickActions } from './EmployeeQuickActions';

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const business = await requireBusinessFromSlug(businessSlug);
  const session = await getAuthSession();
  const effectiveRole = await getEffectiveRoleForBusiness(session as AuthSession | null, business.id);
  const effectivePermissions = await resolveEffectivePermissionsForBusiness(
    session as AuthSession | null,
    business.id,
    effectiveRole,
  );
  const permissions = calculatePermissionsFromEffective(effectivePermissions);
  const appSettings = await getAppSettings(business.id);
  const userId = session?.user?.id ?? '';
  const hasAccessibleChests = await userHasAccessibleChests(business.id, effectiveRole);

  const weeklyFeatureEnabled = appSettings.featureWeeklyActivityEnabled;
  const canViewWeekly = permissions?.weeklyActivity.view ?? false;
  const canEditAll = can(effectivePermissions, 'weekly_activity', 'edit_all');
  const canEdit =
    canEditAll || can(effectivePermissions, 'weekly_activity', 'edit_own');

  const salesFeatureEnabled = isAppFeatureEnabled(appSettings, 'sales');
  const canCreateSale = salesFeatureEnabled && (permissions?.sales.create ?? false);
  const canViewSales = salesFeatureEnabled && (permissions?.sales.view ?? false);
  const canCancelSale = salesFeatureEnabled && (permissions?.sales.cancel ?? false);
  const canViewAllSales = salesFeatureEnabled && (permissions?.sales.viewAll ?? false);
  const canDepositOthers =
    hasRole(effectiveRole, Role.ADMIN) || hasRole(effectiveRole, Role.DIRECTION);
  const canTakeStock = Boolean(appSettings.featureStockEnabled && hasAccessibleChests);
  const ordersFeatureEnabled = appSettings.featureOrdersEnabled;
  const canManageOrders = ordersFeatureEnabled && (permissions?.orders.view ?? false);

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
      listBusinessWeeklyActivities(businessSlug, initialWeekBounds),
      getDiscordAccountIdForUser(prisma, session.user.id),
    ]);
    initialRows = getDataOrThrow(result, 'Erreur lors du chargement de l’activité hebdomadaire');
    viewerDiscordId = discordId;
    defaultDisplayName = discordId
      ? await resolveDiscordPersonName(prisma, business.id, discordId, session.user.name)
      : session.user.name;
  }

  let initialSalesSummary: WeeklySalesSummary | null = null;
  if (canViewSales) {
    const salesResult = await listWeeklySales(businessSlug);
    initialSalesSummary = getDataOrThrow(salesResult, 'Erreur lors du chargement des ventes');
  }

  let initialActiveOrdersPage: OrdersPageResult | null = null;
  let initialOrderAssignments: OrderMailTemplateAssignment[] = [];
  if (canManageOrders) {
    const [ordersResult, assignmentsResult] = await Promise.all([
      getOrdersPage(businessSlug, {
        page: defaultActiveOrdersPageFilters.page,
        pageSize: defaultActiveOrdersPageFilters.pageSize,
        status: defaultActiveOrdersPageFilters.status as Array<
          'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY'
        >,
      }),
      getOrderLetterTemplateAssignments(businessSlug),
    ]);
    initialActiveOrdersPage = getDataOrThrow(
      ordersResult,
      'Erreur lors du chargement des commandes',
    );
    initialOrderAssignments = getDataOrThrow(
      assignmentsResult,
      'Erreur lors du chargement des assignations de modèles de courriers',
    );
  }

  const showActiveOrders = canManageOrders && initialActiveOrdersPage != null;

  let chests: ChestListItem[] = [];
  if (canCreateSale || canTakeStock) {
    const chestsResult = await getChestsList(businessSlug, true);
    chests = getDataOrThrow(chestsResult, 'Erreur lors du chargement des coffres');
  }

  return (
    <Container size="xl" py={{ base: "xs", sm: "xl" }}>
      <PageHeader title="Espace employé" hideOnMobile />

      <EmployeeQuickActions
        canCreateSale={canCreateSale}
        canTakeStock={canTakeStock}
        chests={chests}
        businessSlug={businessSlug}
        initialOrdersPage={showActiveOrders ? initialActiveOrdersPage : null}
        initialAssignments={showActiveOrders ? initialOrderAssignments : []}
      />

      {((weeklyFeatureEnabled && canViewWeekly) || (canViewSales && initialSalesSummary)) && (
        <EmployeeWeeklyOverview
          businessSlug={businessSlug}
          showActivity={weeklyFeatureEnabled && canViewWeekly}
          showSales={Boolean(canViewSales && initialSalesSummary)}
          activity={
            weeklyFeatureEnabled && canViewWeekly
              ? {
                canEdit,
                canEditAll,
                sessionUserId: userId,
                viewerDiscordId,
                defaultDisplayName,
                initialWeekBounds,
                initialRows,
              }
              : undefined
          }
          sales={
            canViewSales && initialSalesSummary
              ? {
                canCancel: canCancelSale,
                canDepositOthers,
                canViewAll: canViewAllSales,
                sessionUserId: userId,
                initialSummary: initialSalesSummary,
              }
              : undefined
          }
        />
      )}
    </Container>
  );
}
