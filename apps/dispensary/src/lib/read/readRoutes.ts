import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import {
  getDispensaryWeeklyActivityHistory,
  getDispensaryWeeklyHoursRecap,
  listDispensaryWeeklyActivities,
  listDispensaryWeeklyActivityTargets,
} from '@/app/_actions/dispensaryWeeklyActivity';
import { getAgendaEvent, listAgendaEvents } from '@/app/_actions/agenda/events';
import { listAgendaEventTodoTasks } from '@/app/_actions/agenda/eventTodos';
import { searchDispensaryUsersForAgenda } from '@/app/_actions/agenda/members';
import { listAgendaTodoLists } from '@/app/_actions/agenda/todoLists';
import { listCabinetPatients } from '@/app/_actions/cabinet/patients';
import { getChestsList } from '@/app/_actions/chests';
import { getCraftRecipesByItemId } from '@/app/_actions/craftRecipes';
import { getItems } from '@/app/_actions/items';
import { getSellableItems, listWeeklySales } from '@/app/_actions/sales';
import { getStockMovementReconciliation, getStockMovementsPage } from '@/app/_actions/stock/movementHistory';
import {
  getItemsWithDetailedStock,
  getItemsWithStock,
  getItemsWithStockForDate,
  getLastStockDaysByChest,
} from '@/app/_actions/stock/queries';
import { getStockConsumptionStats } from '@/app/_actions/stock/statistics';
import { getStockChecksSummary } from '@/app/_actions/stockChecks';
import { getChestStockVisibility } from '@/app/_actions/stockVisibility';
import { searchDispensaryUsersForCabinet } from '@/app/_actions/cabinet/members';
import { searchUsersForDispensaryInvite } from '@/app/_actions/dispensaryMembers';
import {
  listDocumentAccessesAction,
  listTemplateAccessesAction,
  searchUsersForDocumentAccess,
} from '@/app/_actions/documentAccesses';
import { getMailById, getMailsPage } from '@/app/_actions/mails';
import {
  getMailTemplates,
  getManagementMailTemplateById,
  getUserMailTemplateById,
  getUserMailTemplateOptions,
  getUserMailTemplatesPage,
} from '@/app/_actions/mailTemplates';
import {
  getPayrollReportById,
  listPayrollImportableActivityWeeks,
  listPayrollReports,
} from '@/app/_actions/payrollReports';
import { getIndividualCustomers, searchIndividualCustomers } from '@/app/_actions/individualCustomers';
import {
  getMediaContents,
  getMediaLibraryDownloadUrl,
  getMediaTree,
  getMediaUserName,
} from '@/app/_actions/media';
import { getOrderLetterTemplateAssignments } from '@/app/_actions/orderLetterTemplateAssignments';
import { getActiveOrdersForCompanyGroup, getOrderById, getOrdersPage } from '@/app/_actions/orders';

/**
 * Reads exposed as GET (`/api/d/<slug>/read/<query>`) for React Query refetches.
 * Server actions run one at a time per tab, in the navigation queue; these run
 * in parallel. Each entry reuses the read action as-is: auth, tenant, feature
 * and permission checks stay in the action. Only the keys listed here exist.
 */
export const readRoutes = {
  weeklyActivities: (slug: string, input: { periodStart: Date; periodEnd: Date }) =>
    listDispensaryWeeklyActivities(slug, input),
  weeklyActivityTargets: (slug: string, _input?: undefined) =>
    listDispensaryWeeklyActivityTargets(slug),
  weeklyActivityHistory: (
    slug: string,
    input: Parameters<typeof getDispensaryWeeklyActivityHistory>[1],
  ) => getDispensaryWeeklyActivityHistory(slug, input),
  weeklyHoursRecap: (slug: string, input: Parameters<typeof getDispensaryWeeklyHoursRecap>[1]) =>
    getDispensaryWeeklyHoursRecap(slug, input),
  weeklySales: (slug: string, input: { weekDate?: Date }) => listWeeklySales(slug, input?.weekDate),
  ordersPage: (slug: string, input: Parameters<typeof getOrdersPage>[1]) => getOrdersPage(slug, input),
  order: (slug: string, input: { id: string }) => getOrderById(slug, input),
  activeOrdersForCompanyGroup: (slug: string, input: { companyGroupId: string }) =>
    getActiveOrdersForCompanyGroup(slug, input),
  orderLetterAssignments: (slug: string, _input?: undefined) =>
    getOrderLetterTemplateAssignments(slug),
  individualCustomers: (slug: string, _input?: undefined) => getIndividualCustomers(slug),

  // Agenda and to-dos (agenda-ui, see lib/agenda/agendaUiActions)
  agendaEvents: (slug: string, input: Parameters<typeof listAgendaEvents>[1]) =>
    listAgendaEvents(slug, input),
  agendaEvent: (slug: string, input: { eventId: string }) => getAgendaEvent(slug, input?.eventId),
  agendaTodoLists: (slug: string, input: { agendaId: string; archives?: boolean }) =>
    listAgendaTodoLists(slug, input?.agendaId, { archives: input?.archives }),
  agendaEventTodoTasks: (slug: string, input: { eventId: string }) =>
    listAgendaEventTodoTasks(slug, input?.eventId),
  agendaUserSearch: (slug: string, input: { query: string; adminContext?: boolean }) =>
    searchDispensaryUsersForAgenda(slug, input?.query, { adminContext: input?.adminContext }),

  // Search-as-you-type (one request per debounced keystroke)
  individualCustomerSearch: (slug: string, input: { query: string }) =>
    searchIndividualCustomers(slug, input?.query),
  cabinetPatients: (slug: string, input: Parameters<typeof listCabinetPatients>[1]) =>
    listCabinetPatients(slug, input),
  cabinetUserSearch: (slug: string, input: { query: string; adminContext?: boolean }) =>
    searchDispensaryUsersForCabinet(slug, input?.query, { adminContext: input?.adminContext }),
  documentAccessUserSearch: (slug: string, input: { query: string }) =>
    searchUsersForDocumentAccess(slug, input?.query),
  memberInviteUserSearch: (slug: string, input: { query: string }) =>
    searchUsersForDispensaryInvite(slug, input?.query),

  // Stock (inventory-ui, sales, orders, stock pages)
  itemsWithStock: (slug: string, input: { chestId?: string | null }) =>
    getItemsWithStock(slug, input?.chestId),
  itemsWithStockForDate: (slug: string, input: { date: Date; chestId?: string | null }) =>
    getItemsWithStockForDate(slug, input?.date, input?.chestId),
  itemsWithDetailedStock: (slug: string, input: { itemIds?: string[] }) =>
    getItemsWithDetailedStock(slug, input?.itemIds),
  chestsList: (slug: string, input: { onlyEnabled?: boolean }) =>
    getChestsList(slug, input?.onlyEnabled ?? false),
  items: (slug: string, input: { companyGroupId?: string | null }) => getItems(slug, input),
  sellableItems: (slug: string, _input?: undefined) => getSellableItems(slug),
  lastStockDaysByChest: (slug: string, _input?: undefined) => getLastStockDaysByChest(slug),
  stockChecksSummary: (slug: string, _input?: undefined) => getStockChecksSummary(slug),
  chestStockVisibility: (slug: string, input: { chestId: string }) =>
    getChestStockVisibility(slug, input?.chestId),
  craftRecipes: (slug: string, input: { itemId: string; onlyEnabled?: boolean }) =>
    getCraftRecipesByItemId(slug, input?.itemId, input?.onlyEnabled ?? false),
  stockMovementsPage: (slug: string, input: Parameters<typeof getStockMovementsPage>[1]) =>
    getStockMovementsPage(slug, input),
  stockMovementReconciliation: (
    slug: string,
    input: Parameters<typeof getStockMovementReconciliation>[1],
  ) => getStockMovementReconciliation(slug, input),
  stockConsumptionStats: (slug: string, input: { from: Date; to: Date }) =>
    getStockConsumptionStats(slug, input),

  // Media library (media-ui, see lib/media/mediaUiActions)
  mediaContents: (slug: string, input: { folderId: string | null }) =>
    getMediaContents(slug, input?.folderId ?? null),
  mediaTree: (slug: string, _input?: undefined) => getMediaTree(slug),
  mediaDownloadUrl: (slug: string, input: { id: string }) =>
    getMediaLibraryDownloadUrl(slug, input?.id),
  mediaUserName: (slug: string, input: { userId: string }) => getMediaUserName(slug, input?.userId),

  // Mails and templates
  mailsPage: (slug: string, input: Parameters<typeof getMailsPage>[1]) => getMailsPage(slug, input),
  mail: (slug: string, input: { id: string }) => getMailById(slug, input),
  userMailTemplatesPage: (slug: string, input: Parameters<typeof getUserMailTemplatesPage>[1]) =>
    getUserMailTemplatesPage(slug, input),
  userMailTemplate: (slug: string, input: { id: string }) => getUserMailTemplateById(slug, input),
  userMailTemplateOptions: (slug: string, _input?: undefined) => getUserMailTemplateOptions(slug),
  mailTemplates: (slug: string, _input?: undefined) => getMailTemplates(slug),
  managementMailTemplate: (slug: string, input: { id: string }) =>
    getManagementMailTemplateById(slug, input),
  templateAccesses: (slug: string, input: { templateId: string }) =>
    listTemplateAccessesAction(slug, input),
  documentAccesses: (slug: string, input: { documentId: string }) =>
    listDocumentAccessesAction(slug, input),

  // Payroll
  payrollReports: (slug: string, _input?: undefined) => listPayrollReports(slug),
  payrollReport: (slug: string, input: { id: string }) => getPayrollReportById(slug, input?.id),
  payrollImportableWeeks: (slug: string, _input?: undefined) =>
    listPayrollImportableActivityWeeks(slug),
} satisfies ReadRegistry;

export type ReadRoutes = typeof readRoutes;
