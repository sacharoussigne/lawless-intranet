import 'dotenv/config';
import { Client } from 'pg';

const DISPENSARY_DATABASE_URL = process.env.DISPENSARY_DATABASE_URL;
const AGENDA_DATABASE_URL = process.env.AGENDA_DATABASE_URL;

if (!DISPENSARY_DATABASE_URL || !AGENDA_DATABASE_URL) {
  console.error(
    'DISPENSARY_DATABASE_URL and AGENDA_DATABASE_URL environment variables are required',
  );
  process.exit(1);
}

const SCOPE_TYPE = 'dispensary';

type AgendaRow = {
  id: string;
  dispensaryId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemberRow = {
  id: string;
  agendaId: string;
  userId: string;
  accessLevel: string;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  id: string;
  agendaId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ParticipantRow = {
  id: string;
  eventId: string;
  userId: string;
  createdAt: Date;
};

type TodoListRow = {
  id: string;
  agendaId: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type TodoCategoryRow = {
  id: string;
  listId: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type TodoTaskRow = {
  id: string;
  categoryId: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type EventTodoTaskRow = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  completed: boolean;
  completedAt: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

async function main() {
  const source = new Client({ connectionString: DISPENSARY_DATABASE_URL });
  const target = new Client({ connectionString: AGENDA_DATABASE_URL });

  await source.connect();
  await target.connect();

  try {
    const agendas = (
      await source.query<AgendaRow>(
        `SELECT id, "dispensaryId", name, description, "createdAt", "updatedAt"
         FROM agenda
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const members = (
      await source.query<MemberRow>(
        `SELECT id, "agendaId", "userId", "accessLevel", "createdAt", "updatedAt"
         FROM agenda_member
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const events = (
      await source.query<EventRow>(
        `SELECT id, "agendaId", title, description, "startAt", "endAt", "allDay",
                "createdById", "createdAt", "updatedAt"
         FROM agenda_event
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const participants = (
      await source.query<ParticipantRow>(
        `SELECT id, "eventId", "userId", "createdAt"
         FROM agenda_event_participant
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const todoLists = (
      await source.query<TodoListRow>(
        `SELECT id, "agendaId", name, "order", "createdAt", "updatedAt"
         FROM agenda_todo_list
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const todoCategories = (
      await source.query<TodoCategoryRow>(
        `SELECT id, "listId", name, "order", "createdAt", "updatedAt"
         FROM agenda_todo_category
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const todoTasks = (
      await source.query<TodoTaskRow>(
        `SELECT id, "categoryId", title, description, completed, "completedAt",
                "order", "createdAt", "updatedAt"
         FROM agenda_todo_task
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    const eventTodoTasks = (
      await source.query<EventTodoTaskRow>(
        `SELECT id, "eventId", title, description, completed, "completedAt",
                "order", "createdAt", "updatedAt"
         FROM agenda_event_todo_task
         ORDER BY "createdAt" ASC`,
      )
    ).rows;

    await target.query('BEGIN');

    try {
      for (const row of agendas) {
        await target.query(
          `INSERT INTO agenda (id, "scopeType", "scopeId", name, description, "createdAt", "updatedAt")
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

      for (const row of members) {
        await target.query(
          `INSERT INTO agenda_member (id, "agendaId", "userId", "accessLevel", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::"AgendaAccessLevel", $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.agendaId,
            row.userId,
            row.accessLevel,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }

      for (const row of events) {
        await target.query(
          `INSERT INTO agenda_event (
             id, "agendaId", title, description, "startAt", "endAt", "allDay",
             "createdById", "createdAt", "updatedAt"
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.agendaId,
            row.title,
            row.description,
            row.startAt,
            row.endAt,
            row.allDay,
            row.createdById,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }

      for (const row of participants) {
        await target.query(
          `INSERT INTO agenda_event_participant (id, "eventId", "userId", "createdAt")
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.eventId, row.userId, row.createdAt],
        );
      }

      for (const row of todoLists) {
        await target.query(
          `INSERT INTO agenda_todo_list (id, "agendaId", name, "order", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.agendaId,
            row.name,
            row.order,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }

      for (const row of todoCategories) {
        await target.query(
          `INSERT INTO agenda_todo_category (id, "listId", name, "order", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.listId,
            row.name,
            row.order,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }

      for (const row of todoTasks) {
        await target.query(
          `INSERT INTO agenda_todo_task (
             id, "categoryId", title, description, completed, "completedAt",
             "order", "createdAt", "updatedAt"
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.categoryId,
            row.title,
            row.description,
            row.completed,
            row.completedAt,
            row.order,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }

      for (const row of eventTodoTasks) {
        await target.query(
          `INSERT INTO agenda_event_todo_task (
             id, "eventId", title, description, completed, "completedAt",
             "order", "createdAt", "updatedAt"
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            row.id,
            row.eventId,
            row.title,
            row.description,
            row.completed,
            row.completedAt,
            row.order,
            row.createdAt,
            row.updatedAt,
          ],
        );
      }

      await target.query('COMMIT');
    } catch (error) {
      await target.query('ROLLBACK');
      throw error;
    }

    const counts = await target.query<{ table: string; count: string }>(
      `SELECT 'agenda' AS table, COUNT(*)::text AS count FROM agenda
       UNION ALL SELECT 'agenda_member', COUNT(*)::text FROM agenda_member
       UNION ALL SELECT 'agenda_event', COUNT(*)::text FROM agenda_event
       UNION ALL SELECT 'agenda_event_participant', COUNT(*)::text FROM agenda_event_participant
       UNION ALL SELECT 'agenda_todo_list', COUNT(*)::text FROM agenda_todo_list
       UNION ALL SELECT 'agenda_todo_category', COUNT(*)::text FROM agenda_todo_category
       UNION ALL SELECT 'agenda_todo_task', COUNT(*)::text FROM agenda_todo_task
       UNION ALL SELECT 'agenda_event_todo_task', COUNT(*)::text FROM agenda_event_todo_task`,
    );

    console.log('Agenda migration completed.');
    console.log(`Source agendas: ${agendas.length}`);
    for (const row of counts.rows) {
      console.log(`Target ${row.table}: ${row.count}`);
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
