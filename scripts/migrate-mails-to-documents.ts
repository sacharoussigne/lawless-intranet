import 'dotenv/config';
import { Client } from 'pg';

const DISPENSARY_DATABASE_URL = process.env.DISPENSARY_DATABASE_URL;
const DOCUMENTS_DATABASE_URL = process.env.DOCUMENTS_DATABASE_URL;

if (!DISPENSARY_DATABASE_URL || !DOCUMENTS_DATABASE_URL) {
  console.error(
    'DISPENSARY_DATABASE_URL and DOCUMENTS_DATABASE_URL environment variables are required',
  );
  process.exit(1);
}

type MailTemplateRow = {
  id: string;
  dispensaryId: string;
  name: string;
  description: string | null;
  content: string;
  defaultMailName: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MailRow = {
  id: string;
  dispensaryId: string;
  senderId: string;
  name: string;
  receiver: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

async function main() {
  const dispensaryDb = new Client({ connectionString: DISPENSARY_DATABASE_URL });
  const documentsDb = new Client({ connectionString: DOCUMENTS_DATABASE_URL });

  await dispensaryDb.connect();
  await documentsDb.connect();

  try {
    const templatesResult = await dispensaryDb.query<MailTemplateRow>(
      `SELECT id, "dispensaryId", name, description, content, "defaultMailName", "userId", "createdAt", "updatedAt"
       FROM mail_template
       ORDER BY "createdAt" ASC`,
    );

    const mailsResult = await dispensaryDb.query<MailRow>(
      `SELECT id, "dispensaryId", "senderId", name, receiver, content, "createdAt", "updatedAt"
       FROM mail
       ORDER BY "createdAt" ASC`,
    );

    let templatesMigrated = 0;
    let mailsMigrated = 0;

    for (const row of templatesResult.rows) {
      const createdById = row.userId ?? `system:${row.dispensaryId}`;
      const metadata = row.defaultMailName
        ? JSON.stringify({ defaultDocumentName: row.defaultMailName })
        : null;

      await documentsDb.query(
        `INSERT INTO template (id, type, "scopeId", "ownerId", "createdById", name, description, content, metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          'mail',
          row.dispensaryId,
          row.userId,
          createdById,
          row.name,
          row.description,
          row.content,
          metadata,
          row.createdAt,
          row.updatedAt,
        ],
      );
      templatesMigrated += 1;
    }

    for (const row of mailsResult.rows) {
      const metadata = JSON.stringify({ receiver: row.receiver });

      await documentsDb.query(
        `INSERT INTO document (id, type, "scopeId", "ownerId", name, content, metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          'mail',
          row.dispensaryId,
          row.senderId,
          row.name,
          row.content,
          metadata,
          row.createdAt,
          row.updatedAt,
        ],
      );
      mailsMigrated += 1;
    }

    const [{ count: templateCount }] = (
      await documentsDb.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM template WHERE type = 'mail'`,
      )
    ).rows;

    const [{ count: documentCount }] = (
      await documentsDb.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM document WHERE type = 'mail'`,
      )
    ).rows;

    console.log('Migration completed');
    console.log(`Templates migrated: ${templatesMigrated}`);
    console.log(`Mails migrated: ${mailsMigrated}`);
    console.log(`Documents DB templates (mail): ${templateCount}`);
    console.log(`Documents DB documents (mail): ${documentCount}`);
  } finally {
    await dispensaryDb.end();
    await documentsDb.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
