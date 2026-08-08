import 'dotenv/config';
import { randomUUID } from 'node:crypto';
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

const DEFAULT_SOURCE_ACCOUNT_ID = '8ea39c60-068e-4a43-aca0-b05361cc9310';
const DEFAULT_TARGET_DISPENSARY_ID = '00000000-0000-4000-8000-000000000001';

type LegacyAccount = {
  id: string;
  name: string;
  dispensaryId: string;
};

type LegacyWeek = {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  balance: string;
  createdAt: Date;
  updatedAt: Date;
};

type LegacyTransaction = {
  id: string;
  weekId: string;
  date: Date;
  type: string;
  name: string;
  description: string | null;
  amount: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function parseArgs(argv: string[]) {
  let dryRun = false;
  let accountId = DEFAULT_SOURCE_ACCOUNT_ID;
  let dispensaryId = DEFAULT_TARGET_DISPENSARY_ID;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--account-id') {
      const value = argv[++i];
      if (!value) {
        throw new Error('--account-id requires a value');
      }
      accountId = value;
      continue;
    }
    if (arg === '--dispensary-id') {
      const value = argv[++i];
      if (!value) {
        throw new Error('--dispensary-id requires a value');
      }
      dispensaryId = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { dryRun, accountId, dispensaryId };
}

async function main() {
  const { dryRun, accountId, dispensaryId } = parseArgs(process.argv.slice(2));

  const source = new Client({ connectionString: DISPENSARY_DATABASE_URL });
  const target = new Client({ connectionString: BANK_DATABASE_URL });

  await source.connect();
  await target.connect();

  try {
    const accountResult = await source.query<LegacyAccount>(
      `SELECT id, name, "dispensaryId"
       FROM bank_account
       WHERE id = $1`,
      [accountId],
    );

    const account = accountResult.rows[0];
    if (!account) {
      throw new Error(`Legacy bank account not found: ${accountId}`);
    }

    console.log('Source account:');
    console.log(`  id: ${account.id}`);
    console.log(`  name: ${account.name}`);
    console.log(`  originalDispensaryId: ${account.dispensaryId}`);
    console.log(`Target scope: ${SCOPE_TYPE}/${dispensaryId}`);
    console.log(`Mode: ${dryRun ? 'dry-run' : 'write'}`);

    const weeks = (
      await source.query<LegacyWeek>(
        `SELECT id, "weekStart", "weekEnd", balance, "createdAt", "updatedAt"
         FROM bank_account_week
         WHERE "accountId" = $1
         ORDER BY "weekStart" ASC`,
        [accountId],
      )
    ).rows;

    const transactions = (
      await source.query<LegacyTransaction>(
        `SELECT t.id, t."weekId", t.date, t.type, t.name, t.description, t.amount, t."order", t."createdAt", t."updatedAt"
         FROM bank_transaction t
         INNER JOIN bank_account_week w ON w.id = t."weekId"
         WHERE w."accountId" = $1
         ORDER BY w."weekStart" ASC, t."order" ASC, t.date ASC`,
        [accountId],
      )
    ).rows;

    console.log(`Loaded ${weeks.length} week(s) and ${transactions.length} transaction(s)`);

    const existingWeeks = (
      await target.query(
        `SELECT COUNT(*)::int AS count
         FROM bank_week
         WHERE "scopeType" = $1 AND "scopeId" = $2`,
        [SCOPE_TYPE, dispensaryId],
      )
    ).rows[0] as { count: number };

    if (existingWeeks.count > 0) {
      throw new Error(
        `Target already has ${existingWeeks.count} bank_week row(s) for scope ${SCOPE_TYPE}/${dispensaryId}. Aborting.`,
      );
    }

    const weekIdMap = new Map<string, string>();
    for (const week of weeks) {
      weekIdMap.set(week.id, randomUUID());
    }

    if (dryRun) {
      console.log('Dry-run complete (no writes). Sample mapping:');
      for (const week of weeks.slice(0, 3)) {
        const txCount = transactions.filter((t) => t.weekId === week.id).length;
        console.log(
          `  week ${week.weekStart.toISOString()} → ${weekIdMap.get(week.id)} (${txCount} tx, balance=${week.balance})`,
        );
      }
      if (weeks.length > 3) {
        console.log(`  ... and ${weeks.length - 3} more week(s)`);
      }
      return;
    }

    await target.query('BEGIN');

    try {
      for (const week of weeks) {
        const newWeekId = weekIdMap.get(week.id);
        if (!newWeekId) {
          throw new Error(`Missing week id mapping for ${week.id}`);
        }

        await target.query(
          `INSERT INTO bank_week (id, "scopeType", "scopeId", "weekStart", "weekEnd", balance, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newWeekId,
            SCOPE_TYPE,
            dispensaryId,
            week.weekStart,
            week.weekEnd,
            week.balance,
            week.createdAt,
            week.updatedAt,
          ],
        );
      }

      for (const tx of transactions) {
        const newWeekId = weekIdMap.get(tx.weekId);
        if (!newWeekId) {
          throw new Error(`Missing week id mapping for transaction week ${tx.weekId}`);
        }

        await target.query(
          `INSERT INTO bank_transaction (id, "weekId", date, type, name, description, amount, "order", "orderId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10)`,
          [
            randomUUID(),
            newWeekId,
            tx.date,
            tx.type,
            tx.name,
            tx.description,
            tx.amount,
            tx.order,
            tx.createdAt,
            tx.updatedAt,
          ],
        );
      }

      await target.query('COMMIT');
    } catch (error) {
      await target.query('ROLLBACK');
      throw error;
    }

    console.log('Legacy bank account migration complete:');
    console.log(`  weeks: ${weeks.length}`);
    console.log(`  transactions: ${transactions.length}`);
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
