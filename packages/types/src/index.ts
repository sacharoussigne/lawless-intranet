export type UserGender = 'male' | 'female';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  discordId: string | null;
  gender?: UserGender;
  hasCredentialPassword?: boolean;
};

export type AuthSession = {
  session: {
    id: string;
    expiresAt: string;
    impersonatedBy?: string | null;
  };
  user: AuthUser;
};

export type AuthUserPublic = Pick<
  AuthUser,
  "id" | "name" | "image" | "discordId" | "email" | "role" | "gender"
>;

export type DocumentAccessType = "READ" | "WRITE";

export type ResourceAccess = {
  id: string;
  userId: string;
  accessType: DocumentAccessType;
  createdAt: string;
  updatedAt: string;
};

export type MailDocumentMetadata = {
  receiver?: string;
};

export type MailTemplateMetadata = {
  defaultDocumentName?: string;
};

export type DocumentRecord = {
  id: string;
  type: string;
  scopeId: string;
  ownerId: string;
  name: string;
  content: string;
  metadata: MailDocumentMetadata | Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  accesses?: ResourceAccess[];
};

export type DocumentListItem = Omit<DocumentRecord, "content"> & {
  contentPreview: string;
};

export type TemplateRecord = {
  id: string;
  type: string;
  scopeId: string;
  ownerId: string | null;
  createdById: string;
  name: string;
  description: string | null;
  content: string;
  metadata: MailTemplateMetadata | Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  accesses?: ResourceAccess[];
};

export type PaginatedResponse<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type {
  AgendaAccessLevel,
  AgendaAccessRecord,
  AgendaBootstrapRecord,
  AgendaEventParticipantRecord,
  AgendaEventRecord,
  AgendaEventTodoTaskRecord,
  AgendaMemberRecord,
  AgendaMutationMeta,
  AgendaRecord,
  AgendaScopeParams,
  AgendaSummaryRecord,
  AgendaTodoCategoryRecord,
  AgendaTodoListRecord,
  AgendaTodoTaskRecord,
} from './agenda';

export type {
  BankGlobalStatsRecord,
  BankNameSuggestionsRecord,
  BankPlannedOccurrenceRecord,
  BankPlannedOccurrenceStatus,
  BankPlannedTransactionRecord,
  BankScheduleKind,
  BankScopeParams,
  BankTransactionRecord,
  BankTransactionType,
  BankWeekRecord,
} from './bank';

export type {
  CategoryItemRecord,
  ChestLiteRecord,
  ChestRecord,
  ChestStockCheckConfigRecord,
  ChestStockChecksRecord,
  ChestStockVisibilityRecord,
  CompanyGroupForOrdersRecord,
  CompanyGroupRecord,
  CompanyRecord,
  CraftRecipeItemRecord,
  CraftRecipeRecord,
  IdNameRecord,
  IndividualCustomerRecord,
  InventoryScopeParams,
  ItemRecord,
  OrderItemRecord,
  OrderMailAssignmentRecord,
  OrderRecord,
  OrderStatus,
  OrderType,
  OrdersPageRecord,
  RoleChestAccessRecord,
  SaleItemListRecord,
  SaleItemSource,
  SaleListItemRecord,
  SaleStatus,
  SellableItemRecord,
  StockChecksSummaryRecord,
  StockHistoryRecord,
  StockItemWithStockRecord,
  StockMovementKind,
  StockMovementRecord,
  StockMovementsPageRecord,
  StockStatsItemRecord,
  StockStatsRecord,
  WeeklySalesRecord,
} from './inventory';
