-- Drop inventory domain tables (moved to apps/inventory service).
-- Order respects foreign keys.

DROP TABLE IF EXISTS "sale_item" CASCADE;
DROP TABLE IF EXISTS "sale" CASCADE;
DROP TABLE IF EXISTS "order_item" CASCADE;
DROP TABLE IF EXISTS "order" CASCADE;
DROP TABLE IF EXISTS "order_mail_template_assignment" CASCADE;
DROP TABLE IF EXISTS "stock_item_movement" CASCADE;
DROP TABLE IF EXISTS "stock_history" CASCADE;
DROP TABLE IF EXISTS "craft_recipe_item" CASCADE;
DROP TABLE IF EXISTS "craft_recipe" CASCADE;
DROP TABLE IF EXISTS "chest_hidden_item" CASCADE;
DROP TABLE IF EXISTS "chest_hidden_category" CASCADE;
DROP TABLE IF EXISTS "chest_stock_check_category" CASCADE;
DROP TABLE IF EXISTS "chest_stock_check_config" CASCADE;
DROP TABLE IF EXISTS "role_chest_access_chest" CASCADE;
DROP TABLE IF EXISTS "role_chest_access" CASCADE;
DROP TABLE IF EXISTS "company_group_company" CASCADE;
DROP TABLE IF EXISTS "item" CASCADE;
DROP TABLE IF EXISTS "category_item" CASCADE;
DROP TABLE IF EXISTS "chest" CASCADE;
DROP TABLE IF EXISTS "company" CASCADE;
DROP TABLE IF EXISTS "company_group" CASCADE;
DROP TABLE IF EXISTS "individual_customer" CASCADE;

DROP TYPE IF EXISTS "StockMovementKind";
DROP TYPE IF EXISTS "SaleStatus";
DROP TYPE IF EXISTS "SaleItemSource";
DROP TYPE IF EXISTS "OrderStatus";
DROP TYPE IF EXISTS "OrderType";
