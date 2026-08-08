import 'dotenv/config';
import { Client } from 'pg';

const DISPENSARY_DATABASE_URL = process.env.DISPENSARY_DATABASE_URL;
const INVENTORY_DATABASE_URL = process.env.INVENTORY_DATABASE_URL;

if (!DISPENSARY_DATABASE_URL || !INVENTORY_DATABASE_URL) {
  console.error(
    'DISPENSARY_DATABASE_URL and INVENTORY_DATABASE_URL environment variables are required',
  );
  process.exit(1);
}

const SCOPE_TYPE = 'dispensary';

async function main() {
  const source = new Client({ connectionString: DISPENSARY_DATABASE_URL });
  const target = new Client({ connectionString: INVENTORY_DATABASE_URL });

  await source.connect();
  await target.connect();

  try {
    const categories = (
      await source.query(
        `SELECT id, "dispensaryId", name, color, "order", "createdAt", "updatedAt"
         FROM category_item
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const companies = (
      await source.query(
        `SELECT id, "dispensaryId", name, "bankAccountNumber", "createdAt", "updatedAt"
         FROM company
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const companyGroups = (
      await source.query(
        `SELECT id, "dispensaryId", name, description, "createdAt", "updatedAt"
         FROM company_group
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const companyGroupCompanies = (
      await source.query(
        `SELECT id, "companyGroupId", "companyId", "createdAt", "updatedAt"
         FROM company_group_company
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const customers = (
      await source.query(
        `SELECT id, "dispensaryId", name, "createdAt", "updatedAt"
         FROM individual_customer
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const items = (
      await source.query(
        `SELECT id, "dispensaryId", name, description, "minimalQuantity", "isCraftable",
                "isEnabled", "canBeSold", price, weight, "categoryId", "companyGroupId",
                "order", "createdAt", "updatedAt"
         FROM item
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const chests = (
      await source.query(
        `SELECT id, "dispensaryId", name, description, "isEnabled", "order", "createdAt", "updatedAt"
         FROM chest
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const roleChestAccesses = (
      await source.query(
        `SELECT id, "dispensaryId", role, "allChests", "createdAt", "updatedAt"
         FROM role_chest_access
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const roleChestAccessChests = (
      await source.query(
        `SELECT id, "accessId", "chestId"
         FROM role_chest_access_chest
         ORDER BY id ASC`,
      )
    ).rows;

    const chestHiddenCategories = (
      await source.query(
        `SELECT id, "chestId", "categoryId"
         FROM chest_hidden_category
         ORDER BY id ASC`,
      )
    ).rows;

    const chestHiddenItems = (
      await source.query(
        `SELECT id, "chestId", "itemId"
         FROM chest_hidden_item
         ORDER BY id ASC`,
      )
    ).rows;

    const stockCheckConfigs = (
      await source.query(
        `SELECT id, "chestId", "isEnabled"
         FROM chest_stock_check_config
         ORDER BY id ASC`,
      )
    ).rows;

    const stockCheckCategories = (
      await source.query(
        `SELECT id, "configId", "categoryId"
         FROM chest_stock_check_category
         ORDER BY id ASC`,
      )
    ).rows;

    const stockHistory = (
      await source.query(
        `SELECT id, "itemId", "chestId", quantity, timestamp
         FROM stock_history
         ORDER BY timestamp ASC`,
      )
    ).rows;

    const stockMovements = (
      await source.query(
        `SELECT id, "itemId", "chestId", "destinationChestId", quantity, kind, "userId", note, "createdAt"
         FROM stock_item_movement
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const craftRecipes = (
      await source.query(
        `SELECT id, "dispensaryId", name, description, "craftedItemId", quantity, "isEnabled",
                "createdAt", "updatedAt"
         FROM craft_recipe
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const craftRecipeItems = (
      await source.query(
        `SELECT id, "craftRecipeId", "usedItemId", quantity, "createdAt", "updatedAt"
         FROM craft_recipe_item
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const orders = (
      await source.query(
        `SELECT id, "dispensaryId", name, status, type, details, price, "companyId",
                "companyGroupId", "individualCustomerId", "createdAt", "updatedAt"
         FROM "order"
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const orderItems = (
      await source.query(
        `SELECT id, "orderId", "itemId", quantity, "createdAt", "updatedAt"
         FROM order_item
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const orderMailAssignments = (
      await source.query(
        `SELECT id, "dispensaryId", "orderType", "orderStatus", "templateId", "createdAt", "updatedAt"
         FROM order_mail_template_assignment
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const sales = (
      await source.query(
        `SELECT id, "dispensaryId", "userId", status, "customerName", description,
                "individualCustomerId", "priceAdjustment", "createdAt", "cancelledAt",
                "cancelledByUserId", "depositedInCashRegister", "depositedInCashRegisterAt",
                "depositedByUserId"
         FROM sale
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const saleItems = (
      await source.query(
        `SELECT id, "saleId", "itemId", quantity, "unitPrice", source, "chestId"
         FROM sale_item
         ORDER BY id ASC`,
      )
    ).rows;

    await target.query('BEGIN');

    for (const row of categories) {
      await target.query(
        `INSERT INTO category_item (id, "scopeType", "scopeId", name, color, "order", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.color,
          row.order,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of companies) {
      await target.query(
        `INSERT INTO company (id, "scopeType", "scopeId", name, "bankAccountNumber", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.bankAccountNumber,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of companyGroups) {
      await target.query(
        `INSERT INTO company_group (id, "scopeType", "scopeId", name, description, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.description,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of companyGroupCompanies) {
      await target.query(
        `INSERT INTO company_group_company (id, "companyGroupId", "companyId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.companyGroupId, row.companyId, row.createdAt, row.updatedAt],
      );
    }

    for (const row of customers) {
      await target.query(
        `INSERT INTO individual_customer (id, "scopeType", "scopeId", name, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, SCOPE_TYPE, row.dispensaryId, row.name, row.createdAt, row.updatedAt],
      );
    }

    for (const row of items) {
      await target.query(
        `INSERT INTO item (
           id, "scopeType", "scopeId", name, description, "minimalQuantity", "isCraftable",
           "isEnabled", "canBeSold", price, weight, "categoryId", "companyGroupId",
           "order", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.description,
          row.minimalQuantity,
          row.isCraftable,
          row.isEnabled,
          row.canBeSold,
          row.price,
          row.weight,
          row.categoryId,
          row.companyGroupId,
          row.order,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of chests) {
      await target.query(
        `INSERT INTO chest (
           id, "scopeType", "scopeId", name, description, "isEnabled", "order", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.description,
          row.isEnabled,
          row.order,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of roleChestAccesses) {
      await target.query(
        `INSERT INTO role_chest_access (
           id, "scopeType", "scopeId", role, "allChests", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.role,
          row.allChests,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of roleChestAccessChests) {
      await target.query(
        `INSERT INTO role_chest_access_chest (id, "accessId", "chestId")
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.accessId, row.chestId],
      );
    }

    for (const row of chestHiddenCategories) {
      await target.query(
        `INSERT INTO chest_hidden_category (id, "chestId", "categoryId")
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.chestId, row.categoryId],
      );
    }

    for (const row of chestHiddenItems) {
      await target.query(
        `INSERT INTO chest_hidden_item (id, "chestId", "itemId")
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.chestId, row.itemId],
      );
    }

    for (const row of stockCheckConfigs) {
      await target.query(
        `INSERT INTO chest_stock_check_config (id, "chestId", "isEnabled")
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.chestId, row.isEnabled],
      );
    }

    for (const row of stockCheckCategories) {
      await target.query(
        `INSERT INTO chest_stock_check_category (id, "configId", "categoryId")
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.configId, row.categoryId],
      );
    }

    for (const row of stockHistory) {
      await target.query(
        `INSERT INTO stock_history (id, "itemId", "chestId", quantity, timestamp)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.itemId, row.chestId, row.quantity, row.timestamp],
      );
    }

    for (const row of stockMovements) {
      await target.query(
        `INSERT INTO stock_item_movement (
           id, "itemId", "chestId", "destinationChestId", quantity, kind, "userId", note, "createdAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.itemId,
          row.chestId,
          row.destinationChestId,
          row.quantity,
          row.kind,
          row.userId,
          row.note,
          row.createdAt,
        ],
      );
    }

    for (const row of craftRecipes) {
      await target.query(
        `INSERT INTO craft_recipe (
           id, "scopeType", "scopeId", name, description, "craftedItemId", quantity, "isEnabled",
           "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.description,
          row.craftedItemId,
          row.quantity,
          row.isEnabled,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of craftRecipeItems) {
      await target.query(
        `INSERT INTO craft_recipe_item (
           id, "craftRecipeId", "usedItemId", quantity, "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.craftRecipeId,
          row.usedItemId,
          row.quantity,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of orders) {
      await target.query(
        `INSERT INTO "order" (
           id, "scopeType", "scopeId", name, status, type, details, price, "companyId",
           "companyGroupId", "individualCustomerId", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.name,
          row.status,
          row.type,
          row.details,
          row.price,
          row.companyId,
          row.companyGroupId,
          row.individualCustomerId,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of orderItems) {
      await target.query(
        `INSERT INTO order_item (id, "orderId", "itemId", quantity, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.orderId, row.itemId, row.quantity, row.createdAt, row.updatedAt],
      );
    }

    for (const row of orderMailAssignments) {
      await target.query(
        `INSERT INTO order_mail_template_assignment (
           id, "scopeType", "scopeId", "orderType", "orderStatus", "templateId", "createdAt", "updatedAt"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.orderType,
          row.orderStatus,
          row.templateId,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of sales) {
      await target.query(
        `INSERT INTO sale (
           id, "scopeType", "scopeId", "userId", status, "customerName", description,
           "individualCustomerId", "priceAdjustment", "createdAt", "cancelledAt",
           "cancelledByUserId", "depositedInCashRegister", "depositedInCashRegisterAt",
           "depositedByUserId"
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.userId,
          row.status,
          row.customerName,
          row.description,
          row.individualCustomerId,
          row.priceAdjustment,
          row.createdAt,
          row.cancelledAt,
          row.cancelledByUserId,
          row.depositedInCashRegister,
          row.depositedInCashRegisterAt,
          row.depositedByUserId,
        ],
      );
    }

    for (const row of saleItems) {
      await target.query(
        `INSERT INTO sale_item (id, "saleId", "itemId", quantity, "unitPrice", source, "chestId")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.saleId,
          row.itemId,
          row.quantity,
          row.unitPrice,
          row.source,
          row.chestId,
        ],
      );
    }

    await target.query('COMMIT');

    console.log('Inventory migration complete:');
    console.log(`  categories: ${categories.length}`);
    console.log(`  companies: ${companies.length}`);
    console.log(`  companyGroups: ${companyGroups.length}`);
    console.log(`  companyGroupCompanies: ${companyGroupCompanies.length}`);
    console.log(`  customers: ${customers.length}`);
    console.log(`  items: ${items.length}`);
    console.log(`  chests: ${chests.length}`);
    console.log(`  roleChestAccesses: ${roleChestAccesses.length}`);
    console.log(`  roleChestAccessChests: ${roleChestAccessChests.length}`);
    console.log(`  chestHiddenCategories: ${chestHiddenCategories.length}`);
    console.log(`  chestHiddenItems: ${chestHiddenItems.length}`);
    console.log(`  stockCheckConfigs: ${stockCheckConfigs.length}`);
    console.log(`  stockCheckCategories: ${stockCheckCategories.length}`);
    console.log(`  stockHistory: ${stockHistory.length}`);
    console.log(`  stockMovements: ${stockMovements.length}`);
    console.log(`  craftRecipes: ${craftRecipes.length}`);
    console.log(`  craftRecipeItems: ${craftRecipeItems.length}`);
    console.log(`  orders: ${orders.length}`);
    console.log(`  orderItems: ${orderItems.length}`);
    console.log(`  orderMailAssignments: ${orderMailAssignments.length}`);
    console.log(`  sales: ${sales.length}`);
    console.log(`  saleItems: ${saleItems.length}`);
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
