import { listDispensaryWeeklyActivities } from '@/app/_actions/dispensaryWeeklyActivity';
import { listWeeklySales } from '@/app/_actions/sales';
import { getChestsList } from '@/app/_actions/chests';
import { getOrdersPage } from '@/app/_actions/orders';
import { getOrderLetterTemplateAssignments } from '@/app/_actions/orderLetterTemplateAssignments';
import { Container } from '@mantine/core';
import { getAuthSession } from '@/lib/authSession';
import { calculatePermissions } from '@/lib/auth/calculatePermissions';
import { checkRolePermission, hasRole } from '@lawless-intranet/auth-permissions';
import { getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import type { AuthSession } from '@/types/session';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { userHasAccessibleChests } from '@/lib/chests/access';
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
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  const effectiveRole = await getEffectiveRoleForDispensary(session as AuthSession | null, dispensary.id);
  const permissions = calculatePermissions(effectiveRole);
  const appSettings = await getAppSettings(dispensary.id);
  const userId = session?.user?.id ?? '';
  const hasAccessibleChests = await userHasAccessibleChests(dispensary.id, effectiveRole);

  const weeklyFeatureEnabled = appSettings.featureWeeklyDispensaryActivityEnabled;
  const canViewWeekly = permissions?.weeklyDispensaryActivity.view ?? false;
  const canEditAll = checkRolePermission(effectiveRole, 'weekly_dispensary_activity', 'edit_all');
  const canEdit =
    canEditAll || checkRolePermission(effectiveRole, 'weekly_dispensary_activity', 'edit_own');

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
      listDispensaryWeeklyActivities(dispensarySlug, initialWeekBounds),
      getDiscordAccountIdForUser(prisma, session.user.id),
    ]);
    initialRows = getDataOrThrow(result, 'Erreur lors du chargement de l’activité hebdomadaire');
    viewerDiscordId = discordId;
    defaultDisplayName = discordId
      ? await resolveDiscordDisplayName(prisma, discordId)
      : session.user.name;
  }

  let initialSalesSummary: WeeklySalesSummary | null = null;
  if (canViewSales) {
    const salesResult = await listWeeklySales(dispensarySlug);
    initialSalesSummary = getDataOrThrow(salesResult, 'Erreur lors du chargement des ventes');
  }

  let initialActiveOrdersPage: OrdersPageResult | null = null;
  let initialOrderAssignments: OrderMailTemplateAssignment[] = [];
  if (canManageOrders) {
    const [ordersResult, assignmentsResult] = await Promise.all([
      getOrdersPage(dispensarySlug, {
        page: defaultActiveOrdersPageFilters.page,
        pageSize: defaultActiveOrdersPageFilters.pageSize,
        status: defaultActiveOrdersPageFilters.status as Array<
          'DRAFT' | 'LETTER_SENT' | 'PROCESSING' | 'READY'
        >,
      }),
      getOrderLetterTemplateAssignments(dispensarySlug),
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

  const showActiveOrders =
    canManageOrders &&
    initialActiveOrdersPage != null &&
    initialActiveOrdersPage.totalCount > 0;

  let chests: ChestListItem[] = [];
  if (canCreateSale || canTakeStock) {
    const chestsResult = await getChestsList(dispensarySlug, true);
    chests = getDataOrThrow(chestsResult, 'Erreur lors du chargement des coffres');
  }

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Espace employé"
      />

      <EmployeeQuickActions
        canCreateSale={canCreateSale}
        canTakeStock={canTakeStock}
        chests={chests}
        dispensarySlug={dispensarySlug}
        initialOrdersPage={showActiveOrders ? initialActiveOrdersPage : null}
        initialAssignments={showActiveOrders ? initialOrderAssignments : []}
      />

      {((weeklyFeatureEnabled && canViewWeekly) || (canViewSales && initialSalesSummary)) && (
        <EmployeeWeeklyOverview
          dispensarySlug={dispensarySlug}
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
