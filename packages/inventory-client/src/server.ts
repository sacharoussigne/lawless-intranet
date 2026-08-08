import type {
  CategoryItemRecord,
  ChestLiteRecord,
  ChestRecord,
  ChestStockChecksRecord,
  ChestStockVisibilityRecord,
  CompanyGroupForOrdersRecord,
  CompanyGroupRecord,
  CompanyRecord,
  CraftRecipeRecord,
  IdNameRecord,
  IndividualCustomerRecord,
  InventoryScopeParams,
  ItemRecord,
  OrderMailAssignmentRecord,
  OrderRecord,
  OrderStatus,
  OrderType,
  OrdersPageRecord,
  RoleChestAccessRecord,
  SaleListItemRecord,
  SellableItemRecord,
  StockChecksSummaryRecord,
  StockHistoryRecord,
  StockItemWithStockRecord,
  StockMovementKind,
  StockMovementsPageRecord,
  StockStatsRecord,
  WeeklySalesRecord,
} from '@lawless-intranet/types';
import {
  inventoryFetch,
  parseJsonResponse,
  toQuery,
  toQueryWithArray,
  type InventoryFetchOptions,
} from './config';
import type {
  CraftIngredientInput,
  OrderItemInput,
  ReorderItem,
  SaleItemInput,
} from './types';

type ClientOptions = Pick<InventoryFetchOptions, 'cookieHeader'>;
type InternalOptions = ClientOptions & { internal?: boolean };
type SuccessResponse = { success: true };

export async function getInventoryHealth(
  options: ClientOptions = {},
): Promise<{ status: 'ok'; service: 'inventory' }> {
  const response = await inventoryFetch('/api/health', {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function purgeInventoryScope(
  params: InventoryScopeParams,
  options: InternalOptions = {},
): Promise<{ deleted: true }> {
  const response = await inventoryFetch('/api/purge-scope', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    internal: true,
    body: JSON.stringify(params),
  });
  return parseJsonResponse(response);
}

// --- Categories ---

export async function listCategories(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<CategoryItemRecord[]> {
  const response = await inventoryFetch(`/api/categories${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function createCategory(
  input: InventoryScopeParams & { name: string; color?: string },
  options: ClientOptions = {},
): Promise<CategoryItemRecord> {
  const response = await inventoryFetch('/api/categories', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateCategory(
  input: InventoryScopeParams & { id: string; name: string; color?: string },
  options: ClientOptions = {},
): Promise<CategoryItemRecord> {
  const response = await inventoryFetch('/api/categories', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteCategory(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/categories', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function reorderCategories(
  input: InventoryScopeParams & { items: ReorderItem[] },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/categories', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ action: 'reorder', ...input }),
  });
  return parseJsonResponse(response);
}

// --- Items ---

export async function listItems(
  params: InventoryScopeParams & { companyGroupId?: string | null },
  options: ClientOptions = {},
): Promise<ItemRecord[]> {
  const response = await inventoryFetch(
    `/api/items${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      companyGroupId: params.companyGroupId ?? undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createItem(
  input: InventoryScopeParams & {
    name: string;
    description?: string | null;
    minimalQuantity: number;
    isCraftable?: boolean;
    isEnabled?: boolean;
    canBeSold?: boolean;
    price?: number | null;
    weight?: number | null;
    categoryId: string;
    companyGroupId?: string | null;
  },
  options: ClientOptions = {},
): Promise<ItemRecord> {
  const response = await inventoryFetch('/api/items', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateItem(
  input: InventoryScopeParams & {
    id: string;
    name: string;
    description?: string | null;
    minimalQuantity: number;
    isCraftable?: boolean;
    isEnabled?: boolean;
    canBeSold?: boolean;
    price?: number | null;
    weight?: number | null;
    categoryId: string;
    companyGroupId?: string | null;
  },
  options: ClientOptions = {},
): Promise<ItemRecord> {
  const response = await inventoryFetch('/api/items', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteItem(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/items', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function reorderItems(
  input: InventoryScopeParams & { items: ReorderItem[] },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/items', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ action: 'reorder', ...input }),
  });
  return parseJsonResponse(response);
}

// --- Chests ---

export async function listChests(
  params: InventoryScopeParams & { onlyEnabled?: boolean },
  options: ClientOptions = {},
): Promise<ChestRecord[]> {
  const response = await inventoryFetch(
    `/api/chests${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      onlyEnabled: params.onlyEnabled ? 'true' : undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listChestsLite(
  params: InventoryScopeParams & {
    onlyEnabled?: boolean;
    effectiveRole?: string | null;
    bypassAccessFilter?: boolean;
  },
  options: ClientOptions = {},
): Promise<ChestLiteRecord[]> {
  const response = await inventoryFetch(
    `/api/chests${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      lite: 'true',
      onlyEnabled: params.onlyEnabled ? 'true' : undefined,
      effectiveRole: params.effectiveRole ?? undefined,
      bypassAccessFilter: params.bypassAccessFilter ? 'true' : undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createChest(
  input: InventoryScopeParams & {
    name: string;
    description?: string | null;
    isEnabled?: boolean;
  },
  options: ClientOptions = {},
): Promise<ChestRecord> {
  const response = await inventoryFetch('/api/chests', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateChest(
  input: InventoryScopeParams & {
    id: string;
    name: string;
    description?: string | null;
    isEnabled: boolean;
  },
  options: ClientOptions = {},
): Promise<ChestRecord> {
  const response = await inventoryFetch('/api/chests', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteChest(
  input: InventoryScopeParams & { id: string; targetChestId: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/chests', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function reorderChests(
  input: InventoryScopeParams & { items: ReorderItem[] },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/chests', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ action: 'reorder', ...input }),
  });
  return parseJsonResponse(response);
}

// --- Chest access ---

export async function listRoleChestAccesses(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<RoleChestAccessRecord[]> {
  const response = await inventoryFetch(`/api/chest-access${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function upsertRoleChestAccess(
  input: InventoryScopeParams & {
    role: string;
    allChests: boolean;
    chestIds?: string[];
  },
  options: ClientOptions = {},
): Promise<RoleChestAccessRecord> {
  const response = await inventoryFetch('/api/chest-access', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Companies ---

export async function listCompanies(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<CompanyRecord[]> {
  const response = await inventoryFetch(`/api/companies${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function listCompaniesForSelect(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<IdNameRecord[]> {
  const response = await inventoryFetch(
    `/api/companies${toQuery({ ...params, select: 'true' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createCompany(
  input: InventoryScopeParams & {
    name: string;
    bankAccountNumber?: string | null;
    companyGroupIds?: string[];
  },
  options: ClientOptions = {},
): Promise<CompanyRecord> {
  const response = await inventoryFetch('/api/companies', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateCompany(
  input: InventoryScopeParams & {
    id: string;
    name: string;
    bankAccountNumber?: string | null;
    companyGroupIds?: string[];
  },
  options: ClientOptions = {},
): Promise<CompanyRecord> {
  const response = await inventoryFetch('/api/companies', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteCompany(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/companies', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Company groups ---

export async function listCompanyGroups(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<CompanyGroupRecord[]> {
  const response = await inventoryFetch(`/api/company-groups${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function listCompanyGroupsForSelect(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<IdNameRecord[]> {
  const response = await inventoryFetch(
    `/api/company-groups${toQuery({ ...params, mode: 'select' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listCompanyGroupsForOrders(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<CompanyGroupForOrdersRecord[]> {
  const response = await inventoryFetch(
    `/api/company-groups${toQuery({ ...params, mode: 'orders' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createCompanyGroup(
  input: InventoryScopeParams & {
    name: string;
    description?: string | null;
    companyIds?: string[];
  },
  options: ClientOptions = {},
): Promise<CompanyGroupRecord> {
  const response = await inventoryFetch('/api/company-groups', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateCompanyGroup(
  input: InventoryScopeParams & {
    id: string;
    name: string;
    description?: string | null;
    companyIds?: string[];
  },
  options: ClientOptions = {},
): Promise<CompanyGroupRecord> {
  const response = await inventoryFetch('/api/company-groups', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteCompanyGroup(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/company-groups', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Customers ---

export async function listCustomers(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<IndividualCustomerRecord[]> {
  const response = await inventoryFetch(`/api/customers${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function searchCustomers(
  params: InventoryScopeParams & { q: string },
  options: ClientOptions = {},
): Promise<IdNameRecord[]> {
  const response = await inventoryFetch(
    `/api/customers${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      q: params.q,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createCustomer(
  input: InventoryScopeParams & { name: string },
  options: ClientOptions = {},
): Promise<IndividualCustomerRecord> {
  const response = await inventoryFetch('/api/customers', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteCustomerByName(
  input: InventoryScopeParams & { name: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/customers', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Craft recipes ---

export async function listCraftRecipesByItemId(
  params: InventoryScopeParams & { itemId: string; onlyEnabled?: boolean },
  options: ClientOptions = {},
): Promise<CraftRecipeRecord[]> {
  const response = await inventoryFetch(
    `/api/craft-recipes${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      itemId: params.itemId,
      onlyEnabled: params.onlyEnabled ? 'true' : undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createCraftRecipe(
  input: InventoryScopeParams & {
    name: string;
    description?: string | null;
    craftedItemId: string;
    quantity: number;
    isEnabled?: boolean;
    ingredients: CraftIngredientInput[];
  },
  options: ClientOptions = {},
): Promise<CraftRecipeRecord> {
  const response = await inventoryFetch('/api/craft-recipes', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateCraftRecipe(
  input: InventoryScopeParams & {
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
    isEnabled?: boolean;
    ingredients: CraftIngredientInput[];
  },
  options: ClientOptions = {},
): Promise<CraftRecipeRecord> {
  const response = await inventoryFetch('/api/craft-recipes', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteCraftRecipe(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/craft-recipes', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Orders ---

export async function getOrderById(
  params: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<OrderRecord> {
  const response = await inventoryFetch(
    `/api/orders${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      id: params.id,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function getActiveOrdersForCompanyGroup(
  params: InventoryScopeParams & { companyGroupId: string },
  options: ClientOptions = {},
): Promise<OrderRecord[]> {
  const response = await inventoryFetch(
    `/api/orders${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      activeForCompanyGroupId: params.companyGroupId,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listOrdersPage(
  params: InventoryScopeParams & {
    page?: number;
    pageSize?: number;
    status?: OrderStatus[] | null;
    type?: OrderType | null;
    search?: string;
    createdAtFrom?: string | null;
    createdAtTo?: string | null;
  },
  options: ClientOptions = {},
): Promise<OrdersPageRecord> {
  const response = await inventoryFetch(
    `/api/orders${toQueryWithArray({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      page: params.page,
      pageSize: params.pageSize,
      status: params.status ?? undefined,
      type: params.type ?? undefined,
      search: params.search,
      createdAtFrom: params.createdAtFrom,
      createdAtTo: params.createdAtTo,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createOrder(
  input: InventoryScopeParams & {
    name?: string;
    status?: OrderStatus;
    type?: OrderType;
    details?: string | null;
    price?: number | null;
    companyId?: string | null;
    individualCustomerId?: string | null;
    companyGroupId?: string | null;
    items: OrderItemInput[];
  },
  options: ClientOptions = {},
): Promise<OrderRecord> {
  const response = await inventoryFetch('/api/orders', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateOrder(
  input: InventoryScopeParams & {
    id: string;
    name?: string;
    status?: Exclude<OrderStatus, 'COMPLETED'>;
    type?: OrderType;
    details?: string | null;
    price?: number | null;
    items?: OrderItemInput[];
  },
  options: ClientOptions = {},
): Promise<OrderRecord> {
  const response = await inventoryFetch('/api/orders', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteOrder(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/orders', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function completeOrder(
  input: InventoryScopeParams & {
    id: string;
    name?: string;
    type?: OrderType;
    details?: string | null;
    price?: number | null;
    items?: OrderItemInput[];
    skipStock: boolean;
    stockLines?: { itemId: string; quantity: number; chestId: string }[];
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<OrderRecord> {
  const { id, ...rest } = input;
  const response = await inventoryFetch(`/api/orders/${id}/complete`, {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ id, ...rest }),
  });
  return parseJsonResponse(response);
}

// --- Order mail assignments ---

export async function listOrderMailAssignments(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<OrderMailAssignmentRecord[]> {
  const response = await inventoryFetch(
    `/api/order-mail-assignments${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function getOrderMailAssignment(
  params: InventoryScopeParams & {
    orderType: OrderType;
    orderStatus: OrderStatus;
  },
  options: ClientOptions = {},
): Promise<OrderMailAssignmentRecord | null> {
  const response = await inventoryFetch(
    `/api/order-mail-assignments${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createOrderMailAssignment(
  input: InventoryScopeParams & {
    orderType: OrderType;
    orderStatus: OrderStatus;
    templateId: string;
  },
  options: ClientOptions = {},
): Promise<OrderMailAssignmentRecord> {
  const response = await inventoryFetch('/api/order-mail-assignments', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function updateOrderMailAssignment(
  input: InventoryScopeParams & { id: string; templateId: string },
  options: ClientOptions = {},
): Promise<OrderMailAssignmentRecord> {
  const response = await inventoryFetch('/api/order-mail-assignments', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteOrderMailAssignment(
  input: InventoryScopeParams & { id: string },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/order-mail-assignments', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Sales ---

export async function getSellableItems(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<SellableItemRecord[]> {
  const response = await inventoryFetch(
    `/api/sales${toQuery({ ...params, sellable: 'true' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function listWeeklySales(
  params: InventoryScopeParams & {
    weekDate?: string;
    canViewAll?: boolean;
  },
  options: ClientOptions = {},
): Promise<WeeklySalesRecord> {
  const response = await inventoryFetch(
    `/api/sales${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      weekDate: params.weekDate,
      canViewAll: params.canViewAll ? 'true' : undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function createSale(
  input: InventoryScopeParams & {
    userId?: string;
    defaultChestId?: string | null;
    customerName?: string | null;
    description?: string | null;
    individualCustomerId?: string | null;
    priceAdjustment?: number;
    items: SaleItemInput[];
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<SaleListItemRecord> {
  const response = await inventoryFetch('/api/sales', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function cancelSale(
  input: InventoryScopeParams & {
    id: string;
    userId?: string;
    canViewAll?: boolean;
  },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/sales', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ action: 'cancel', ...input }),
  });
  return parseJsonResponse(response);
}

export async function depositSale(
  input: InventoryScopeParams & {
    id: string;
    userId?: string;
    canDepositOthers?: boolean;
  },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/sales', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ action: 'deposit', ...input }),
  });
  return parseJsonResponse(response);
}

export async function deleteSale(
  input: InventoryScopeParams & {
    id: string;
    userId?: string;
    isAdmin?: boolean;
  },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/sales', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({ action: 'delete', ...input }),
  });
  return parseJsonResponse(response);
}

// --- Stock checks ---

export async function getChestStockCheckConfigs(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<ChestStockChecksRecord> {
  const response = await inventoryFetch(`/api/stock-checks${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}

export async function getStockChecksSummary(
  params: InventoryScopeParams,
  options: ClientOptions = {},
): Promise<StockChecksSummaryRecord> {
  const response = await inventoryFetch(
    `/api/stock-checks${toQuery({ ...params, summary: 'true' })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function upsertChestStockCheckConfig(
  input: InventoryScopeParams & {
    chestId: string;
    isEnabled: boolean;
    categoryIds: string[];
  },
  options: ClientOptions = {},
): Promise<{ id: string; chestId: string; isEnabled: boolean }> {
  const response = await inventoryFetch('/api/stock-checks', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Stock visibility ---

export async function getChestStockVisibility(
  params: InventoryScopeParams & { chestId: string },
  options: ClientOptions = {},
): Promise<ChestStockVisibilityRecord> {
  const response = await inventoryFetch(
    `/api/stock-visibility${toQuery(params)}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function setChestCategoryHidden(
  input: InventoryScopeParams & {
    chestId: string;
    categoryId: string;
    hidden: boolean;
  },
  options: ClientOptions = {},
): Promise<{ ok: true }> {
  const response = await inventoryFetch('/api/stock-visibility', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function setChestItemHidden(
  input: InventoryScopeParams & {
    chestId: string;
    itemId: string;
    hidden: boolean;
  },
  options: ClientOptions = {},
): Promise<{ ok: true }> {
  const response = await inventoryFetch('/api/stock-visibility', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Stock query ---

export async function queryItemsWithStock(
  params: InventoryScopeParams & {
    chestId?: string | null;
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<StockItemWithStockRecord[]> {
  const response = await inventoryFetch(
    `/api/stock/query${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      mode: 'today',
      chestId: params.chestId ?? undefined,
      effectiveRole: params.effectiveRole ?? undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function queryItemsWithStockForDate(
  params: InventoryScopeParams & {
    date: string;
    chestId?: string | null;
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<StockItemWithStockRecord[]> {
  const response = await inventoryFetch(
    `/api/stock/query${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      mode: 'date',
      date: params.date,
      chestId: params.chestId ?? undefined,
      effectiveRole: params.effectiveRole ?? undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function queryItemsWithDetailedStock(
  params: InventoryScopeParams & {
    itemIds?: string[];
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<StockItemWithStockRecord[]> {
  const response = await inventoryFetch(
    `/api/stock/query${toQueryWithArray({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      mode: 'detailed',
      itemId: params.itemIds,
      effectiveRole: params.effectiveRole ?? undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function getLastStockDaysByChest(
  params: InventoryScopeParams & { effectiveRole?: string | null },
  options: ClientOptions = {},
): Promise<Record<string, string | null>> {
  const response = await inventoryFetch(
    `/api/stock/query${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      mode: 'last-days',
      effectiveRole: params.effectiveRole ?? undefined,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

// --- Stock mutations ---

export async function updateStock(
  input: InventoryScopeParams & {
    stocks: { itemId: string; quantity: number }[];
    chestId?: string | null;
    skipHistory?: boolean;
    userId?: string | null;
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<StockHistoryRecord[]> {
  const response = await inventoryFetch('/api/stock/update', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function moveItemsWithChests(
  input: InventoryScopeParams & {
    mode: 'take' | 'deposit';
    items: { itemId: string; quantity: number; chestId: string }[];
    userId?: string | null;
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<{ success: true; count: number; mode: 'take' | 'deposit' }> {
  const response = await inventoryFetch('/api/stock/take', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function transferStock(
  input: InventoryScopeParams & {
    sourceChestId: string;
    destinationChestId: string;
    items: { itemId: string; quantity: number }[];
    userId?: string | null;
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<SuccessResponse> {
  const response = await inventoryFetch('/api/stock/transfer', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function overwriteStockForDate(
  input: InventoryScopeParams & {
    date: string | Date;
    stocks: { itemId: string; quantity: number }[];
    chestId?: string | null;
  },
  options: ClientOptions = {},
): Promise<{ count: number }> {
  const response = await inventoryFetch('/api/stock/overwrite', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify({
      ...input,
      date: typeof input.date === 'string' ? input.date : input.date.toISOString(),
    }),
  });
  return parseJsonResponse(response);
}

export async function craftItem(
  input: InventoryScopeParams & {
    craftedItemId: string;
    recipeId: string;
    times: number;
    sourceChestId?: string | null;
    ingredientChests: { ingredientId: string; chestId: string }[];
    destinationChestId?: string | null;
    userId?: string | null;
    effectiveRole?: string | null;
  },
  options: ClientOptions = {},
): Promise<{ success: true; quantityProduced: number }> {
  const response = await inventoryFetch('/api/stock/craft', {
    method: 'POST',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Stock movements ---

export async function listStockMovements(
  params: InventoryScopeParams & {
    page?: number;
    pageSize?: number;
    itemSearch?: string;
    itemId?: string;
    chestFilter?: 'all' | 'global' | string;
    kind?: StockMovementKind;
    from?: string;
    to?: string;
  },
  options: ClientOptions = {},
): Promise<StockMovementsPageRecord> {
  const response = await inventoryFetch(
    `/api/stock/movements${toQuery({
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      page: params.page,
      pageSize: params.pageSize,
      itemSearch: params.itemSearch,
      itemId: params.itemId,
      chestFilter: params.chestFilter,
      kind: params.kind,
      from: params.from,
      to: params.to,
    })}`,
    { cookieHeader: options.cookieHeader },
  );
  return parseJsonResponse(response);
}

export async function updateStockMovement(
  input: InventoryScopeParams & {
    id: string;
    quantity?: number;
    kind?: StockMovementKind;
    note?: string | null;
  },
  options: ClientOptions = {},
): Promise<{
  id: string;
  itemId: string;
  chestId: string | null;
  destinationChestId: string | null;
  quantity: number;
  kind: StockMovementKind;
  userId: string | null;
  note: string | null;
  createdAt: string;
}> {
  const response = await inventoryFetch('/api/stock/movements', {
    method: 'PATCH',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

export async function deleteStockMovements(
  input: InventoryScopeParams & { ids: string[] },
  options: ClientOptions = {},
): Promise<{ deleted: number }> {
  const response = await inventoryFetch('/api/stock/movements', {
    method: 'DELETE',
    cookieHeader: options.cookieHeader,
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response);
}

// --- Stock stats ---

export async function getStockConsumptionStats(
  params: InventoryScopeParams & { from: string; to: string },
  options: ClientOptions = {},
): Promise<StockStatsRecord> {
  const response = await inventoryFetch(`/api/stock/stats${toQuery(params)}`, {
    cookieHeader: options.cookieHeader,
  });
  return parseJsonResponse(response);
}
