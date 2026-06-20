/**
 * One-shot migration: copy auth tables from dispensary DB to auth DB preserving IDs.
 *
 * Usage:
 *   pnpm migrate:users-to-auth
 *   pnpm migrate:users-to-auth -- --reset-auth
 *
 * Environment (root .env or shell):
 *   SOURCE_DATABASE_URL — legacy dispensary DB with user/account tables
 *   OLD_DISPENSARY_DATABASE_URL — alias for SOURCE (typo OLD_DISPENSARYDATABASE_URL also accepted)
 *   AUTH_DATABASE_URL — target auth DB (falls back to DATABASE_URL from apps/auth/.env)
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import pg from 'pg';

const rootDir = resolve(import.meta.dirname, '..');

loadEnv({ path: resolve(rootDir, '.env') });
loadEnv({ path: resolve(rootDir, 'apps/auth/.env') });

const resetAuth = process.argv.includes('--reset-auth');

function resolveSourceUrl(): string | undefined {
  return (
    process.env.SOURCE_DATABASE_URL ??
    process.env.OLD_DISPENSARY_DATABASE_URL ??
    process.env.OLD_DISPENSARYDATABASE_URL
  );
}

function resolveAuthUrl(): string | undefined {
  return process.env.AUTH_DATABASE_URL ?? process.env.DATABASE_URL;
}

const sourceUrl = resolveSourceUrl();
const authUrl = resolveAuthUrl();

if (!sourceUrl) {
  throw new Error(
    'SOURCE_DATABASE_URL (or OLD_DISPENSARY_DATABASE_URL) is required — legacy DB with user/account tables',
  );
}

if (!authUrl) {
  throw new Error(
    'AUTH_DATABASE_URL is required — set it in root .env or apps/auth/.env (DATABASE_URL)',
  );
}

const tables = ['user', 'session', 'account', 'verification'] as const;

async function tableExists(client: pg.Client, table: string): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [table],
  );
  return rows[0]?.exists ?? false;
}

async function assertSourceHasAuthTables(source: pg.Client) {
  const hasUser = await tableExists(source, 'user');
  if (!hasUser) {
    throw new Error(
      'Source DB has no "user" table — auth tables were already removed. Use a backup (OLD_DISPENSARY_DATABASE_URL).',
    );
  }
}

async function assertTargetHasAuthTables(target: pg.Client) {
  const hasUser = await tableExists(target, 'user');
  if (!hasUser) {
    throw new Error(
      'Auth DB has no "user" table — run "cd apps/auth && pnpm db:migrate" first.',
    );
  }
}

async function resetAuthTables(target: pg.Client) {
  console.log('[reset-auth] truncating auth tables…');
  await target.query(
    'TRUNCATE TABLE "session", "account", "verification", "user" RESTART IDENTITY CASCADE',
  );
}

async function copyTable(
  source: pg.Client,
  target: pg.Client,
  table: (typeof tables)[number],
) {
  const { rows } = await source.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`[${table}] no rows to copy`);
    return 0;
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
    return rows.length;
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }
}

async function reportOrphanUserIds(
  target: pg.Client,
  dispensaryUrl: string | undefined,
) {
  if (!dispensaryUrl) {
    return;
  }

  const dispensary = new pg.Client({ connectionString: dispensaryUrl });
  await dispensary.connect();

  try {
    const hasMember = await tableExists(dispensary, 'dispensary_member');
    if (!hasMember) {
      return;
    }

    const { rows: memberRows } = await dispensary.query<{ userId: string }>(
      `SELECT DISTINCT "userId" FROM "dispensary_member"`,
    );
    const { rows: authUsers } = await target.query<{ id: string }>(
      `SELECT id FROM "user"`,
    );
    const authIds = new Set(authUsers.map((row) => row.id));
    const orphans = memberRows.map((row) => row.userId).filter((id) => !authIds.has(id));

    if (orphans.length === 0) {
      console.log('[orphans] all dispensary_member.userId values exist in auth DB');
      return;
    }

    console.warn(
      `[orphans] ${orphans.length} dispensary_member.userId not found in auth DB (first 10):`,
    );
    console.warn(orphans.slice(0, 10).join(', '));
  } finally {
    await dispensary.end();
  }
}

async function main() {
  console.log(`[config] source=${maskUrl(sourceUrl)}`);
  console.log(`[config] target=${maskUrl(authUrl)}`);
  if (resetAuth) {
    console.log('[config] --reset-auth enabled');
  }

  const source = new pg.Client({ connectionString: sourceUrl });
  const target = new pg.Client({ connectionString: authUrl });

  await source.connect();
  await target.connect();

  try {
    await assertSourceHasAuthTables(source);
    await assertTargetHasAuthTables(target);

    if (resetAuth) {
      await resetAuthTables(target);
    }

    for (const table of tables) {
      await copyTable(source, target, table);
    }

    let allMatch = true;
    for (const table of tables) {
      const sourceCount = await source.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${table}"`,
      );
      const targetCount = await target.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM "${table}"`,
      );
      const sourceN = sourceCount.rows[0].count;
      const targetN = targetCount.rows[0].count;
      const ok = targetN >= sourceN;
      if (!ok) {
        allMatch = false;
      }
      console.log(
        `[verify:${table}] source=${sourceN} target=${targetN}${ok ? '' : ' MISMATCH'}`,
      );
    }

    await reportOrphanUserIds(target, process.env.DISPENSARY_DATABASE_URL);

    if (!allMatch) {
      process.exitCode = 1;
      console.error('Verification failed — target counts are lower than source.');
    } else {
      console.log('Migration completed successfully.');
    }
  } finally {
    await source.end();
    await target.end();
  }
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '(invalid url)';
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
