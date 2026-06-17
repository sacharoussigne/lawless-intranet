/**
 * One-shot migration: copy auth tables from dispensary DB to auth DB preserving IDs.
 *
 * Usage:
 *   SOURCE_DATABASE_URL=postgresql://...dispensary AUTH_DATABASE_URL=postgresql://...auth \
 *   pnpm tsx scripts/migrate-users-to-auth.ts
 */
import pg from 'pg';

const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
const authUrl = process.env.AUTH_DATABASE_URL;

if (!sourceUrl) {
  throw new Error('SOURCE_DATABASE_URL or DATABASE_URL is required');
}

if (!authUrl) {
  throw new Error('AUTH_DATABASE_URL is required');
}

const tables = ['user', 'session', 'account', 'verification'] as const;

async function copyTable(
  source: pg.Client,
  target: pg.Client,
  table: (typeof tables)[number],
) {
  const { rows } = await source.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`[${table}] no rows to copy`);
    return;
  }

  const columns = Object.keys(rows[0]);
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

  await target.query('BEGIN');
  try {
    for (const row of rows) {
      const values = columns.map((column) => row[column]);
      await target.query(
        `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
    }
    await target.query('COMMIT');
    console.log(`[${table}] copied ${rows.length} rows`);
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const source = new pg.Client({ connectionString: sourceUrl });
  const target = new pg.Client({ connectionString: authUrl });

  await source.connect();
  await target.connect();

  try {
    for (const table of tables) {
      await copyTable(source, target, table);
    }

    for (const table of tables) {
      const sourceCount = await source.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const targetCount = await target.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      console.log(
        `[verify:${table}] source=${sourceCount.rows[0].count} target=${targetCount.rows[0].count}`,
      );
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
