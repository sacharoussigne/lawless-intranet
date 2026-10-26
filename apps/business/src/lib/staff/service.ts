import type { Prisma, PrismaClient } from '@prisma/client';
import { fetchUserProfiles } from '@/lib/authUsers';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { employmentStatusOf, roleAt, stayConflict, type StayPeriod } from './periods';
import type { Employment, EmploymentEndReason, EmploymentStatus } from './types';

/** Transaction client (or the client itself). */
export type StaffDb = Prisma.TransactionClient | PrismaClient;

/** A refused change of the register; `status` is the action's response status. */
export class StaffRegisterError extends Error {
  constructor(
    message: string,
    readonly status: 404 | 409 | 422 = 409,
  ) {
    super(message);
  }
}

const staySelect = {
  id: true,
  role: true,
  startedAt: true,
  endedAt: true,
  endReason: true,
} as const;

type StayRow = Prisma.BusinessEmploymentGetPayload<{ select: typeof staySelect }>;

async function findLink(db: StaffDb, businessId: string, discordUserId: string) {
  const link = await db.businessPerson.findFirst({
    where: { businessId, person: { discordUserId } },
    select: { id: true, role: true },
  });
  if (!link) throw new StaffRegisterError('Profil introuvable pour cette personne', 404);
  return link;
}

async function staysOf(db: StaffDb, businessPersonId: string): Promise<StayRow[]> {
  return db.businessEmployment.findMany({
    where: { businessPersonId },
    select: staySelect,
    orderBy: { startedAt: 'asc' },
  });
}

function openStayOf(stays: StayRow[]): StayRow {
  const open = stays.find((stay) => stay.endedAt == null);
  if (!open) throw new StaffRegisterError('Cette personne n’est pas employée actuellement.');
  return open;
}

function assertNoConflict(stays: StayPeriod[], candidate: StayPeriod, ignoreIndex?: number) {
  const conflict = stayConflict(stays, candidate, ignoreIndex);
  if (conflict) throw new StaffRegisterError(conflict, 422);
}

function assertWithinStay(stay: StayPeriod, at: Date) {
  if (at < stay.startedAt || (stay.endedAt && at > stay.endedAt)) {
    throw new StaffRegisterError('Cette date est en dehors du passage de cette personne.', 422);
  }
}

function normalizeNote(note: string | null | undefined): string | null {
  return note?.trim() || null;
}

/** Opens a new stay: the person is employed from `startedAt` with this grade. */
export async function hirePerson(
  db: StaffDb,
  input: {
    businessId: string;
    discordUserId: string;
    role: string | null;
    startedAt: Date;
    note?: string | null;
    createdById: string;
  },
): Promise<void> {
  const link = await findLink(db, input.businessId, input.discordUserId);
  const stays = await staysOf(db, link.id);
  assertNoConflict(stays, { startedAt: input.startedAt, endedAt: null });

  await db.businessEmployment.create({
    data: {
      businessPersonId: link.id,
      role: input.role,
      startedAt: input.startedAt,
      createdById: input.createdById,
      events: {
        create: {
          type: 'HIRED',
          toRole: input.role,
          occurredAt: input.startedAt,
          note: normalizeNote(input.note),
          createdById: input.createdById,
        },
      },
    },
  });
  await db.businessPerson.update({ where: { id: link.id }, data: { role: input.role } });
}

/** Grade change during the open stay; `BusinessPerson.role` follows. No-op when the grade is the same. */
export async function changeEmploymentRole(
  db: StaffDb,
  input: {
    businessId: string;
    discordUserId: string;
    role: string | null;
    occurredAt: Date;
    note?: string | null;
    createdById: string;
  },
): Promise<void> {
  const link = await findLink(db, input.businessId, input.discordUserId);
  const open = openStayOf(await staysOf(db, link.id));
  if ((open.role ?? null) === input.role) return;
  assertWithinStay(open, input.occurredAt);

  await db.businessEmploymentEvent.create({
    data: {
      employmentId: open.id,
      type: 'ROLE_CHANGED',
      fromRole: open.role,
      toRole: input.role,
      occurredAt: input.occurredAt,
      note: normalizeNote(input.note),
      createdById: input.createdById,
    },
  });
  await db.businessEmployment.update({ where: { id: open.id }, data: { role: input.role } });
  await db.businessPerson.update({ where: { id: link.id }, data: { role: input.role } });
}

/**
 * Grade set from the person's form: recorded as a grade change when the person
 * is employed, otherwise only the profile changes (done by the caller).
 */
export async function recordRoleChangeIfEmployed(
  db: StaffDb,
  input: { businessId: string; discordUserId: string; role: string | null; createdById: string },
): Promise<void> {
  const link = await findLink(db, input.businessId, input.discordUserId);
  const open = (await staysOf(db, link.id)).find((stay) => stay.endedAt == null);
  if (!open || (open.role ?? null) === input.role) return;
  const occurredAt = new Date();
  await db.businessEmploymentEvent.create({
    data: {
      employmentId: open.id,
      type: 'ROLE_CHANGED',
      fromRole: open.role,
      toRole: input.role,
      occurredAt: occurredAt < open.startedAt ? open.startedAt : occurredAt,
      createdById: input.createdById,
    },
  });
  await db.businessEmployment.update({ where: { id: open.id }, data: { role: input.role } });
}

/** Closes the open stay (resignation, dismissal…). The grade is kept on the profile. */
export async function endEmployment(
  db: StaffDb,
  input: {
    businessId: string;
    discordUserId: string;
    endedAt: Date;
    endReason: EmploymentEndReason;
    note?: string | null;
    createdById: string;
  },
): Promise<void> {
  const link = await findLink(db, input.businessId, input.discordUserId);
  const open = openStayOf(await staysOf(db, link.id));
  if (input.endedAt < open.startedAt) {
    throw new StaffRegisterError('La date de départ est avant la date d’embauche.', 422);
  }
  const lastEvent = await db.businessEmploymentEvent.findFirst({
    where: { employmentId: open.id },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  if (lastEvent && input.endedAt < lastEvent.occurredAt) {
    throw new StaffRegisterError('La date de départ est avant le dernier événement de ce passage.', 422);
  }

  await db.businessEmployment.update({
    where: { id: open.id },
    data: { endedAt: input.endedAt, endReason: input.endReason },
  });
  await db.businessEmploymentEvent.create({
    data: {
      employmentId: open.id,
      type: 'LEFT',
      fromRole: open.role,
      endReason: input.endReason,
      occurredAt: input.endedAt,
      note: normalizeNote(input.note),
      createdById: input.createdById,
    },
  });
}

async function findEventOfBusiness(db: StaffDb, businessId: string, eventId: string) {
  const event = await db.businessEmploymentEvent.findFirst({
    where: { id: eventId, employment: { businessPerson: { businessId } } },
    select: {
      id: true,
      type: true,
      fromRole: true,
      occurredAt: true,
      employment: { select: { ...staySelect, businessPersonId: true } },
    },
  });
  if (!event) throw new StaffRegisterError('Événement introuvable', 404);
  return event;
}

/** Fixes the date, note or leaving reason of an event; hiring and leaving dates move the stay. */
export async function updateEmploymentEvent(
  db: StaffDb,
  input: {
    businessId: string;
    eventId: string;
    occurredAt: Date;
    note?: string | null;
    endReason?: EmploymentEndReason;
  },
): Promise<void> {
  const event = await findEventOfBusiness(db, input.businessId, input.eventId);
  const stay = event.employment;
  const stays = await staysOf(db, stay.businessPersonId);
  const index = stays.findIndex((s) => s.id === stay.id);
  const others = await db.businessEmploymentEvent.findMany({
    where: { employmentId: stay.id, NOT: { id: event.id } },
    select: { occurredAt: true },
  });

  if (event.type === 'HIRED') {
    assertNoConflict(stays, { startedAt: input.occurredAt, endedAt: stay.endedAt }, index);
    if (others.some((other) => other.occurredAt < input.occurredAt)) {
      throw new StaffRegisterError('L’embauche doit rester le premier événement du passage.', 422);
    }
    await db.businessEmployment.update({ where: { id: stay.id }, data: { startedAt: input.occurredAt } });
  } else if (event.type === 'LEFT') {
    assertNoConflict(stays, { startedAt: stay.startedAt, endedAt: input.occurredAt }, index);
    if (others.some((other) => other.occurredAt > input.occurredAt)) {
      throw new StaffRegisterError('Le départ doit rester le dernier événement du passage.', 422);
    }
    await db.businessEmployment.update({
      where: { id: stay.id },
      data: { endedAt: input.occurredAt, ...(input.endReason ? { endReason: input.endReason } : {}) },
    });
  } else {
    assertWithinStay(stay, input.occurredAt);
  }

  await db.businessEmploymentEvent.update({
    where: { id: event.id },
    data: {
      occurredAt: input.occurredAt,
      note: normalizeNote(input.note),
      ...(event.type === 'LEFT' && input.endReason ? { endReason: input.endReason } : {}),
    },
  });
}

/**
 * Cancels the person's latest event (a mistake): a hiring removes its stay, a
 * leaving reopens it, a grade change puts the previous grade back.
 */
export async function cancelLatestEmploymentEvent(
  db: StaffDb,
  input: { businessId: string; eventId: string },
): Promise<void> {
  const event = await findEventOfBusiness(db, input.businessId, input.eventId);
  const stay = event.employment;
  const latest = await db.businessEmploymentEvent.findFirst({
    where: { employment: { businessPersonId: stay.businessPersonId } },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });
  if (latest?.id !== event.id) {
    throw new StaffRegisterError('Seul le dernier événement de la personne peut être annulé.');
  }

  if (event.type === 'HIRED') {
    await db.businessEmployment.delete({ where: { id: stay.id } });
    return;
  }
  await db.businessEmploymentEvent.delete({ where: { id: event.id } });
  if (event.type === 'LEFT') {
    await db.businessEmployment.update({ where: { id: stay.id }, data: { endedAt: null, endReason: null } });
    return;
  }
  await db.businessEmployment.update({ where: { id: stay.id }, data: { role: event.fromRole } });
  if (stay.endedAt == null) {
    await db.businessPerson.update({
      where: { id: stay.businessPersonId },
      data: { role: event.fromRole },
    });
  }
}

/** Stays of a person in the business, newest first, each with its events newest first. */
export async function listEmploymentHistory(
  db: StaffDb,
  businessId: string,
  discordUserId: string,
): Promise<Employment[]> {
  const link = await findLink(db, businessId, discordUserId);
  const rows = await db.businessEmployment.findMany({
    where: { businessPersonId: link.id },
    orderBy: { startedAt: 'desc' },
    select: {
      ...staySelect,
      events: {
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          type: true,
          fromRole: true,
          toRole: true,
          endReason: true,
          note: true,
          occurredAt: true,
          createdById: true,
        },
      },
    },
  });

  const authorIds = [
    ...new Set(rows.flatMap((row) => row.events.map((e) => e.createdById)).filter((id): id is string => Boolean(id))),
  ];
  // Best effort: an author without a known account is shown without a name.
  const authors = authorIds.length > 0 ? await fetchUserProfiles(authorIds) : new Map();

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    endReason: row.endReason,
    events: row.events.map(({ createdById, ...event }) => ({
      ...event,
      createdByName: createdById ? (authors.get(createdById)?.name ?? null) : null,
    })),
  }));
}

/** Staff status of every person of the business, by Discord ID. */
export async function loadEmploymentStatuses(
  db: StaffDb,
  businessId: string,
): Promise<Map<string, EmploymentStatus>> {
  const links = await db.businessPerson.findMany({
    where: { businessId },
    select: {
      person: { select: { discordUserId: true } },
      employments: { select: { startedAt: true, endedAt: true } },
    },
  });
  return new Map(links.map((link) => [link.person.discordUserId, employmentStatusOf(link.employments)]));
}

/** A person employed during a period, as payroll and the city hall letter need it. */
export type StaffMemberOfPeriod = {
  discordUserId: string;
  displayName: string;
  /** Grade held at the end of the period (or when the person left). */
  role: string | null;
  accountNumber: number | null;
  /** Caisse unit of the person's salary type; null = the report's caisse price. */
  caisseUnitUsd: number | null;
};

/** People employed at some point of [from, to] (a stay overlaps it), sorted by name. */
export async function loadStaffOfPeriod(
  db: StaffDb,
  businessId: string,
  from: Date,
  to: Date,
): Promise<StaffMemberOfPeriod[]> {
  const links = await db.businessPerson.findMany({
    where: {
      businessId,
      employments: { some: { startedAt: { lte: to }, OR: [{ endedAt: null }, { endedAt: { gte: from } }] } },
    },
    select: {
      person: {
        select: { discordUserId: true, fixedDisplayName: true, lastDisplayName: true, accountNumber: true },
      },
      salaryType: { select: { caisseUnitUsd: true } },
      employments: {
        select: {
          events: {
            where: { type: { in: ['HIRED', 'ROLE_CHANGED'] } },
            select: { occurredAt: true, toRole: true },
          },
        },
      },
    },
  });

  return links
    .map((link) => ({
      discordUserId: link.person.discordUserId,
      displayName: pickProfileDisplayName(link.person, link.person.discordUserId),
      role: roleAt(
        link.employments.flatMap((stay) => stay.events),
        to,
      ),
      accountNumber: link.person.accountNumber,
      caisseUnitUsd: link.salaryType ? Number(link.salaryType.caisseUnitUsd) : null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
}
