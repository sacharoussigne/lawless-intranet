import 'dotenv/config';
import { Client } from 'pg';

const DISPENSARY_DATABASE_URL = process.env.DISPENSARY_DATABASE_URL;
const BANK_DATABASE_URL = process.env.BANK_DATABASE_URL;

if (!DISPENSARY_DATABASE_URL || !BANK_DATABASE_URL) {
  console.error(
    'DISPENSARY_DATABASE_URL and BANK_DATABASE_URL environment variables are required',
  );
  process.exit(1);
}

const SCOPE_TYPE = 'dispensary';

async function main() {
  const source = new Client({ connectionString: DISPENSARY_DATABASE_URL });
  const target = new Client({ connectionString: BANK_DATABASE_URL });

  await source.connect();
  await target.connect();

  try {
    const weeks = (
      await source.query(
        `SELECT id, "dispensaryId", "weekStart", "weekEnd", balance, "createdAt", "updatedAt"
         FROM bank_week
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const transactions = (
      await source.query(
        `SELECT id, "weekId", date, type, name, description, amount, "order", "orderId", "createdAt", "updatedAt"
         FROM bank_transaction
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const planned = (
      await source.query(
        `SELECT id, "dispensaryId", type, name, description, amount, "scheduleKind", "onceDate", weekdays, "isActive", "createdAt", "updatedAt"
         FROM bank_planned_transaction
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const occurrences = (
      await source.query(
        `SELECT id, "dispensaryId", "plannedTransactionId", date, status, "confirmedTransactionId", "createdAt", "updatedAt"
         FROM bank_planned_occurrence
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const nameSuggestions = (
      await source.query(
        `SELECT id, "dispensaryId", value, "createdAt", "updatedAt"
         FROM transaction_name_suggestion
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const descriptionSuggestions = (
      await source.query(
        `SELECT id, "dispensaryId", value, "createdAt", "updatedAt"
         FROM transaction_description_suggestion
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    await target.query('BEGIN');

    for (const row of weeks) {
      await target.query(
        `INSERT INTO bank_week (id, "scopeType", "scopeId", "weekStart", "weekEnd", balance, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.weekStart,
          row.weekEnd,
          row.balance,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of transactions) {
      await target.query(
        `INSERT INTO bank_transaction (id, "weekId", date, type, name, description, amount, "order", "orderId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.weekId,
          row.date,
          row.type,
          row.name,
          row.description,
          row.amount,
          row.order,
          row.orderId,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of planned) {
      await target.query(
        `INSERT INTO bank_planned_transaction (id, "scopeType", "scopeId", type, name, description, amount, "scheduleKind", "onceDate", weekdays, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.type,
          row.name,
          row.description,
          row.amount,
          row.scheduleKind,
          row.onceDate,
          row.weekdays,
          row.isActive,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of occurrences) {
      await target.query(
        `INSERT INTO bank_planned_occurrence (id, "scopeType", "scopeId", "plannedTransactionId", date, status, "confirmedTransactionId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          SCOPE_TYPE,
          row.dispensaryId,
          row.plannedTransactionId,
          row.date,
          row.status,
          row.confirmedTransactionId,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }

    for (const row of nameSuggestions) {
      await target.query(
        `INSERT INTO transaction_name_suggestion (id, "scopeType", "scopeId", value, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, SCOPE_TYPE, row.dispensaryId, row.value, row.createdAt, row.updatedAt],
      );
    }

    for (const row of descriptionSuggestions) {
      await target.query(
        `INSERT INTO transaction_description_suggestion (id, "scopeType", "scopeId", value, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, SCOPE_TYPE, row.dispensaryId, row.value, row.createdAt, row.updatedAt],
      );
    }

    await target.query('COMMIT');

    console.log('Bank migration complete:');
    console.log(`  weeks: ${weeks.length}`);
    console.log(`  transactions: ${transactions.length}`);
    console.log(`  planned: ${planned.length}`);
    console.log(`  occurrences: ${occurrences.length}`);
    console.log(`  nameSuggestions: ${nameSuggestions.length}`);
    console.log(`  descriptionSuggestions: ${descriptionSuggestions.length}`);
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
