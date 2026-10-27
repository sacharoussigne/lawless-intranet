'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { loggedAction } from '@/lib/logs/writer';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { discordUserIdSchema } from '@/lib/people/discordId';
import { PAYROLL_EMPLOYEE_ROLES } from '@/lib/businessDiscordProfile/constants';
import {
  cancelLatestEmploymentEvent,
  changeEmploymentRole,
  endEmployment,
  hirePerson,
  listEmploymentHistory,
  StaffRegisterError,
  updateEmploymentEvent,
} from '@/lib/staff/service';
import { EMPLOYMENT_END_REASONS } from '@/lib/staff/types';
import { syncPersonAccess } from '@/lib/staff/access';

/** Same rights as Gestion › Personnes, where the register lives. */
const staffGuard = {
  feature: 'weeklyActivity' as const,
  permission: {
    resource: 'weekly_activity' as const,
    action: 'edit_all',
    message: 'Permission refusée : la gestion des personnes demande de pouvoir modifier toute l’activité',
  },
};

const roleSchema = z.enum(PAYROLL_EMPLOYEE_ROLES).nullable();
const dateSchema = z.coerce.date({ invalid_type_error: 'Date invalide' });
const noteSchema = z.string().trim().max(1000).nullable().optional();
const endReasonSchema = z.enum(EMPLOYMENT_END_REASONS);

const hireSchema = z.object({
  discordUserId: discordUserIdSchema,
  role: roleSchema,
  startedAt: dateSchema,
  note: noteSchema,
});

const changeRoleSchema = z.object({
  discordUserId: discordUserIdSchema,
  role: roleSchema,
  occurredAt: dateSchema,
  note: noteSchema,
});

const endSchema = z.object({
  discordUserId: discordUserIdSchema,
  endedAt: dateSchema,
  endReason: endReasonSchema,
  note: noteSchema,
});

const updateEventSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: dateSchema,
  note: noteSchema,
  endReason: endReasonSchema.optional(),
});

const cancelEventSchema = z.object({ eventId: z.string().min(1) });

/** Person of an event, read before the change (cancelling a hiring deletes its events). */
async function discordIdOfEvent(businessId: string, eventId: string): Promise<string | null> {
  const event = await prisma.businessEmploymentEvent.findFirst({
    where: { id: eventId, employment: { businessPerson: { businessId } } },
    select: { employment: { select: { businessPerson: { select: { person: { select: { discordUserId: true } } } } } } },
  });
  return event?.employment.businessPerson.person.discordUserId ?? null;
}

function staffErrorResponse(error: unknown, defaultMessage: string) {
  if (error instanceof StaffRegisterError) {
    return { status: error.status, error: error.message };
  }
  return actionErrorParser(error, defaultMessage);
}

export async function listStaffHistory(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, staffGuard);
    if (!ctx.ok) return ctx.response;
    const { discordUserId } = z.object({ discordUserId: discordUserIdSchema }).parse(input);
    const data = await listEmploymentHistory(prisma, ctx.tenant.businessId, discordUserId);
    return { status: 200 as const, data };
  } catch (error) {
    return staffErrorResponse(error, 'Erreur lors du chargement de l’historique');
  }
}

async function hireStaffMemberUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, staffGuard);
    if (!ctx.ok) return ctx.response;
    const data = hireSchema.parse(input);
    await prisma.$transaction((tx) =>
      hirePerson(tx, { ...data, businessId: ctx.tenant.businessId, createdById: ctx.session.user.id }),
    );
    await syncPersonAccess(prisma, ctx.tenant.businessId, data.discordUserId);
    return { status: 200 as const, data: { discordUserId: data.discordUserId } };
  } catch (error) {
    return staffErrorResponse(error, 'Erreur lors de l’embauche');
  }
}

async function changeStaffRoleUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, staffGuard);
    if (!ctx.ok) return ctx.response;
    const data = changeRoleSchema.parse(input);
    await prisma.$transaction((tx) =>
      changeEmploymentRole(tx, { ...data, businessId: ctx.tenant.businessId, createdById: ctx.session.user.id }),
    );
    await syncPersonAccess(prisma, ctx.tenant.businessId, data.discordUserId);
    return { status: 200 as const, data: { discordUserId: data.discordUserId } };
  } catch (error) {
    return staffErrorResponse(error, 'Erreur lors du changement de grade');
  }
}

async function endStaffEmploymentUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, staffGuard);
    if (!ctx.ok) return ctx.response;
    const data = endSchema.parse(input);
    await prisma.$transaction((tx) =>
      endEmployment(tx, { ...data, businessId: ctx.tenant.businessId, createdById: ctx.session.user.id }),
    );
    await syncPersonAccess(prisma, ctx.tenant.businessId, data.discordUserId);
    return { status: 200 as const, data: { discordUserId: data.discordUserId } };
  } catch (error) {
    return staffErrorResponse(error, 'Erreur lors de l’enregistrement du départ');
  }
}

async function updateStaffEventUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, staffGuard);
    if (!ctx.ok) return ctx.response;
    const data = updateEventSchema.parse(input);
    const discordUserId = await discordIdOfEvent(ctx.tenant.businessId, data.eventId);
    await prisma.$transaction((tx) =>
      updateEmploymentEvent(tx, { ...data, businessId: ctx.tenant.businessId }),
    );
    if (discordUserId) await syncPersonAccess(prisma, ctx.tenant.businessId, discordUserId);
    return { status: 200 as const, data: { eventId: data.eventId } };
  } catch (error) {
    return staffErrorResponse(error, 'Erreur lors de la modification de l’événement');
  }
}

async function cancelStaffEventUnlogged(businessSlug: string, input: unknown) {
  try {
    const ctx = await requireTenantServerActionContext(businessSlug, staffGuard);
    if (!ctx.ok) return ctx.response;
    const data = cancelEventSchema.parse(input);
    const discordUserId = await discordIdOfEvent(ctx.tenant.businessId, data.eventId);
    await prisma.$transaction((tx) =>
      cancelLatestEmploymentEvent(tx, { ...data, businessId: ctx.tenant.businessId }),
    );
    if (discordUserId) await syncPersonAccess(prisma, ctx.tenant.businessId, discordUserId);
    return { status: 200 as const, data: { eventId: data.eventId } };
  } catch (error) {
    return staffErrorResponse(error, 'Erreur lors de l’annulation de l’événement');
  }
}

const personTarget = ([, input]: [string, unknown]) =>
  (input as { discordUserId?: string } | undefined)?.discordUserId;
const eventTarget = ([, input]: [string, unknown]) => (input as { eventId?: string } | undefined)?.eventId;

export async function hireStaffMember(...args: Parameters<typeof hireStaffMemberUnlogged>) {
  return loggedAction({ feature: 'weeklyActivity', event: 'staff.hire', target: personTarget }, args, () =>
    hireStaffMemberUnlogged(...args),
  );
}

export async function changeStaffRole(...args: Parameters<typeof changeStaffRoleUnlogged>) {
  return loggedAction({ feature: 'weeklyActivity', event: 'staff.changeRole', target: personTarget }, args, () =>
    changeStaffRoleUnlogged(...args),
  );
}

export async function endStaffEmployment(...args: Parameters<typeof endStaffEmploymentUnlogged>) {
  return loggedAction({ feature: 'weeklyActivity', event: 'staff.end', target: personTarget }, args, () =>
    endStaffEmploymentUnlogged(...args),
  );
}

export async function updateStaffEvent(...args: Parameters<typeof updateStaffEventUnlogged>) {
  return loggedAction({ feature: 'weeklyActivity', event: 'staff.updateEvent', target: eventTarget }, args, () =>
    updateStaffEventUnlogged(...args),
  );
}

export async function cancelStaffEvent(...args: Parameters<typeof cancelStaffEventUnlogged>) {
  return loggedAction({ feature: 'weeklyActivity', event: 'staff.cancelEvent', target: eventTarget }, args, () =>
    cancelStaffEventUnlogged(...args),
  );
}
