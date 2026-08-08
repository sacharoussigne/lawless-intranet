-- CreateEnum
CREATE TYPE "StockMovementKind" AS ENUM (
  'MANUAL_FIRST_COUNT',
  'MANUAL_ADJUST',
  'CRAFT_CONSUME',
  'CRAFT_PRODUCE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'OVERWRITE',
  'TAKE_OUT',
  'DEPOSIT_IN',
  'SALE_OUT',
  'SALE_CANCEL_RESTORE',
  'ORDER_IN',
  'ORDER_OUT'
);

CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');

CREATE TYPE "SaleItemSource" AS ENUM ('POCKET', 'CHEST');

CREATE TYPE "OrderStatus" AS ENUM (
  'DRAFT',
  'LETTER_SENT',
  'PROCESSING',
  'READY',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "OrderType" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateTable
CREATE TABLE "category_item" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#ffffff',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_group" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankAccountNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "individual_customer" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chest" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minimalQuantity" INTEGER NOT NULL,
    "isCraftable" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "canBeSold" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(10,2),
    "weight" DOUBLE PRECISION,
    "categoryId" TEXT NOT NULL,
    "companyGroupId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_group_company" (
    "id" TEXT NOT NULL,
    "companyGroupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_group_company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_chest_access" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allChests" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_chest_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_chest_access_chest" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "chestId" TEXT NOT NULL,

    CONSTRAINT "role_chest_access_chest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chest_hidden_category" (
    "id" TEXT NOT NULL,
    "chestId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "chest_hidden_category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chest_hidden_item" (
    "id" TEXT NOT NULL,
    "chestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "chest_hidden_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chest_stock_check_config" (
    "id" TEXT NOT NULL,
    "chestId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chest_stock_check_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chest_stock_check_category" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "chest_stock_check_category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_history" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "chestId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_item_movement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "chestId" TEXT,
    "destinationChestId" TEXT,
    "quantity" INTEGER NOT NULL,
    "kind" "StockMovementKind" NOT NULL,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_item_movement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "craft_recipe" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "craftedItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "craft_recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "craft_recipe_item" (
    "id" TEXT NOT NULL,
    "craftRecipeId" TEXT NOT NULL,
    "usedItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "craft_recipe_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "OrderType" NOT NULL DEFAULT 'INCOMING',
    "details" TEXT,
    "price" DECIMAL(10,2),
    "companyId" TEXT,
    "companyGroupId" TEXT,
    "individualCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_mail_template_assignment" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "orderStatus" "OrderStatus" NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_mail_template_assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "customerName" TEXT,
    "description" TEXT,
    "individualCustomerId" TEXT,
    "priceAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "depositedInCashRegister" BOOLEAN NOT NULL DEFAULT false,
    "depositedInCashRegisterAt" TIMESTAMP(3),
    "depositedByUserId" TEXT,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_item" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "source" "SaleItemSource" NOT NULL,
    "chestId" TEXT,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "category_item_scopeType_scopeId_idx" ON "category_item"("scopeType", "scopeId");
CREATE INDEX "company_group_scopeType_scopeId_idx" ON "company_group"("scopeType", "scopeId");
CREATE INDEX "company_scopeType_scopeId_idx" ON "company"("scopeType", "scopeId");
CREATE INDEX "individual_customer_scopeType_scopeId_idx" ON "individual_customer"("scopeType", "scopeId");
CREATE INDEX "chest_scopeType_scopeId_idx" ON "chest"("scopeType", "scopeId");
CREATE INDEX "item_categoryId_idx" ON "item"("categoryId");
CREATE INDEX "item_companyGroupId_idx" ON "item"("companyGroupId");
CREATE INDEX "item_scopeType_scopeId_idx" ON "item"("scopeType", "scopeId");
CREATE UNIQUE INDEX "company_group_company_companyGroupId_companyId_key" ON "company_group_company"("companyGroupId", "companyId");
CREATE INDEX "company_group_company_companyGroupId_idx" ON "company_group_company"("companyGroupId");
CREATE INDEX "company_group_company_companyId_idx" ON "company_group_company"("companyId");
CREATE UNIQUE INDEX "role_chest_access_scopeType_scopeId_role_key" ON "role_chest_access"("scopeType", "scopeId", "role");
CREATE INDEX "role_chest_access_scopeType_scopeId_idx" ON "role_chest_access"("scopeType", "scopeId");
CREATE UNIQUE INDEX "role_chest_access_chest_accessId_chestId_key" ON "role_chest_access_chest"("accessId", "chestId");
CREATE INDEX "role_chest_access_chest_accessId_idx" ON "role_chest_access_chest"("accessId");
CREATE INDEX "role_chest_access_chest_chestId_idx" ON "role_chest_access_chest"("chestId");
CREATE UNIQUE INDEX "chest_hidden_category_chestId_categoryId_key" ON "chest_hidden_category"("chestId", "categoryId");
CREATE INDEX "chest_hidden_category_chestId_idx" ON "chest_hidden_category"("chestId");
CREATE INDEX "chest_hidden_category_categoryId_idx" ON "chest_hidden_category"("categoryId");
CREATE UNIQUE INDEX "chest_hidden_item_chestId_itemId_key" ON "chest_hidden_item"("chestId", "itemId");
CREATE INDEX "chest_hidden_item_chestId_idx" ON "chest_hidden_item"("chestId");
CREATE INDEX "chest_hidden_item_itemId_idx" ON "chest_hidden_item"("itemId");
CREATE UNIQUE INDEX "chest_stock_check_config_chestId_key" ON "chest_stock_check_config"("chestId");
CREATE INDEX "chest_stock_check_config_chestId_idx" ON "chest_stock_check_config"("chestId");
CREATE UNIQUE INDEX "chest_stock_check_category_configId_categoryId_key" ON "chest_stock_check_category"("configId", "categoryId");
CREATE INDEX "chest_stock_check_category_configId_idx" ON "chest_stock_check_category"("configId");
CREATE INDEX "chest_stock_check_category_categoryId_idx" ON "chest_stock_check_category"("categoryId");
CREATE INDEX "stock_history_itemId_idx" ON "stock_history"("itemId");
CREATE INDEX "stock_history_chestId_idx" ON "stock_history"("chestId");
CREATE INDEX "stock_history_timestamp_idx" ON "stock_history"("timestamp");
CREATE INDEX "stock_history_itemId_chestId_timestamp_idx" ON "stock_history"("itemId", "chestId", "timestamp");
CREATE INDEX "stock_item_movement_itemId_createdAt_idx" ON "stock_item_movement"("itemId", "createdAt");
CREATE INDEX "stock_item_movement_createdAt_idx" ON "stock_item_movement"("createdAt");
CREATE INDEX "stock_item_movement_chestId_createdAt_idx" ON "stock_item_movement"("chestId", "createdAt");
CREATE INDEX "stock_item_movement_itemId_chestId_createdAt_idx" ON "stock_item_movement"("itemId", "chestId", "createdAt");
CREATE INDEX "craft_recipe_craftedItemId_idx" ON "craft_recipe"("craftedItemId");
CREATE INDEX "craft_recipe_scopeType_scopeId_idx" ON "craft_recipe"("scopeType", "scopeId");
CREATE INDEX "craft_recipe_item_craftRecipeId_idx" ON "craft_recipe_item"("craftRecipeId");
CREATE INDEX "craft_recipe_item_usedItemId_idx" ON "craft_recipe_item"("usedItemId");
CREATE INDEX "order_companyId_idx" ON "order"("companyId");
CREATE INDEX "order_companyGroupId_idx" ON "order"("companyGroupId");
CREATE INDEX "order_individualCustomerId_idx" ON "order"("individualCustomerId");
CREATE INDEX "order_status_idx" ON "order"("status");
CREATE INDEX "order_type_idx" ON "order"("type");
CREATE INDEX "order_scopeType_scopeId_idx" ON "order"("scopeType", "scopeId");
CREATE INDEX "order_scopeType_scopeId_createdAt_idx" ON "order"("scopeType", "scopeId", "createdAt" DESC);
CREATE UNIQUE INDEX "order_item_orderId_itemId_key" ON "order_item"("orderId", "itemId");
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");
CREATE INDEX "order_item_itemId_idx" ON "order_item"("itemId");
CREATE UNIQUE INDEX "order_mail_template_assignment_scopeType_scopeId_orderType_orderStatus_key" ON "order_mail_template_assignment"("scopeType", "scopeId", "orderType", "orderStatus");
CREATE INDEX "order_mail_template_assignment_templateId_idx" ON "order_mail_template_assignment"("templateId");
CREATE INDEX "order_mail_template_assignment_orderType_orderStatus_idx" ON "order_mail_template_assignment"("orderType", "orderStatus");
CREATE INDEX "order_mail_template_assignment_scopeType_scopeId_idx" ON "order_mail_template_assignment"("scopeType", "scopeId");
CREATE INDEX "sale_scopeType_scopeId_createdAt_idx" ON "sale"("scopeType", "scopeId", "createdAt");
CREATE INDEX "sale_scopeType_scopeId_userId_createdAt_idx" ON "sale"("scopeType", "scopeId", "userId", "createdAt");
CREATE INDEX "sale_userId_idx" ON "sale"("userId");
CREATE INDEX "sale_individualCustomerId_idx" ON "sale"("individualCustomerId");
CREATE INDEX "sale_item_saleId_idx" ON "sale_item"("saleId");
CREATE INDEX "sale_item_itemId_idx" ON "sale_item"("itemId");
CREATE INDEX "sale_item_chestId_idx" ON "sale_item"("chestId");

-- ForeignKeys
ALTER TABLE "item" ADD CONSTRAINT "item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item" ADD CONSTRAINT "item_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_group_company" ADD CONSTRAINT "company_group_company_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_group_company" ADD CONSTRAINT "company_group_company_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_chest_access_chest" ADD CONSTRAINT "role_chest_access_chest_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "role_chest_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_chest_access_chest" ADD CONSTRAINT "role_chest_access_chest_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_hidden_category" ADD CONSTRAINT "chest_hidden_category_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_hidden_category" ADD CONSTRAINT "chest_hidden_category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_hidden_item" ADD CONSTRAINT "chest_hidden_item_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_hidden_item" ADD CONSTRAINT "chest_hidden_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_stock_check_config" ADD CONSTRAINT "chest_stock_check_config_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_stock_check_category" ADD CONSTRAINT "chest_stock_check_category_configId_fkey" FOREIGN KEY ("configId") REFERENCES "chest_stock_check_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chest_stock_check_category" ADD CONSTRAINT "chest_stock_check_category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_item_movement" ADD CONSTRAINT "stock_item_movement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_item_movement" ADD CONSTRAINT "stock_item_movement_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_item_movement" ADD CONSTRAINT "stock_item_movement_destinationChestId_fkey" FOREIGN KEY ("destinationChestId") REFERENCES "chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "craft_recipe" ADD CONSTRAINT "craft_recipe_craftedItemId_fkey" FOREIGN KEY ("craftedItemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "craft_recipe_item" ADD CONSTRAINT "craft_recipe_item_craftRecipeId_fkey" FOREIGN KEY ("craftRecipeId") REFERENCES "craft_recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "craft_recipe_item" ADD CONSTRAINT "craft_recipe_item_usedItemId_fkey" FOREIGN KEY ("usedItemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order" ADD CONSTRAINT "order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order" ADD CONSTRAINT "order_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order" ADD CONSTRAINT "order_individualCustomerId_fkey" FOREIGN KEY ("individualCustomerId") REFERENCES "individual_customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale" ADD CONSTRAINT "sale_individualCustomerId_fkey" FOREIGN KEY ("individualCustomerId") REFERENCES "individual_customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
