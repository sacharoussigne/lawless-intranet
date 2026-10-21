-- Drop agenda module tables (moved to dedicated agenda service)

DROP TABLE IF EXISTS "agenda_event_todo_task";
DROP TABLE IF EXISTS "agenda_event_participant";
DROP TABLE IF EXISTS "agenda_event";
DROP TABLE IF EXISTS "agenda_todo_task";
DROP TABLE IF EXISTS "agenda_todo_category";
DROP TABLE IF EXISTS "agenda_todo_list";
DROP TABLE IF EXISTS "agenda_member";
DROP TABLE IF EXISTS "agenda";

DROP TYPE IF EXISTS "AgendaAccessLevel";
