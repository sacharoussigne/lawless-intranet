import type { AgendaAccessLevel } from '@prisma/client';
import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';

export type AgendaAccessResult =
  | { ok: true; accessLevel: AgendaAccessLevel | null }
  | { ok: false; status: number; error: string };

export function canReadAgenda(
  level: AgendaAccessLevel | null | undefined,
): boolean {
  return level === 'OWNER' || level === 'WRITE' || level === 'READ';
}

export function canWriteAgenda(
  level: AgendaAccessLevel | null | undefined,
): boolean {
  return level === 'OWNER' || level === 'WRITE';
}

export function canOwnAgenda(
  level: AgendaAccessLevel | null | undefined,
): boolean {
  return level === 'OWNER';
}

export async function resolveAgendaAccess(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  userId: string,
): Promise<AgendaAccessResult> {
  const agenda = await prisma.agenda.findFirst({
    where: { id: agendaId, ...scopeWhere(scopeType, scopeId) },
    select: { id: true },
  });

  if (!agenda) {
    return { ok: false, status: 404, error: 'Agenda introuvable' };
  }

  const membership = await prisma.agendaMember.findUnique({
    where: { agendaId_userId: { agendaId, userId } },
    select: { accessLevel: true },
  });

  if (!membership) {
    return { ok: false, status: 403, error: 'Accès non autorisé à cet agenda' };
  }

  return {
    ok: true,
    accessLevel: membership.accessLevel,
  };
}

export async function requireAgendaRead(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  userId: string,
): Promise<AgendaAccessResult> {
  const access = await resolveAgendaAccess(scopeType, scopeId, agendaId, userId);
  if (!access.ok) return access;

  if (!canReadAgenda(access.accessLevel)) {
    return { ok: false, status: 403, error: 'Accès lecture requis' };
  }

  return access;
}

export async function requireAgendaWrite(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  userId: string,
): Promise<AgendaAccessResult> {
  const access = await resolveAgendaAccess(scopeType, scopeId, agendaId, userId);
  if (!access.ok) return access;

  if (!canWriteAgenda(access.accessLevel)) {
    return { ok: false, status: 403, error: 'Accès écriture requis' };
  }

  return access;
}

export async function requireAgendaOwner(
  scopeType: string,
  scopeId: string,
  agendaId: string,
  userId: string,
): Promise<AgendaAccessResult> {
  const access = await resolveAgendaAccess(scopeType, scopeId, agendaId, userId);
  if (!access.ok) return access;

  if (!canOwnAgenda(access.accessLevel)) {
    return { ok: false, status: 403, error: 'Droits propriétaire requis' };
  }

  return access;
}

export async function canManageAgendaMembers(
  agendaId: string,
  userId: string,
  scopeAdmin = false,
): Promise<boolean> {
  if (scopeAdmin) {
    return true;
  }

  const membership = await prisma.agendaMember.findUnique({
    where: { agendaId_userId: { agendaId, userId } },
    select: { accessLevel: true },
  });

  return canOwnAgenda(membership?.accessLevel);
}

export async function listAccessibleAgendaIds(
  scopeType: string,
  scopeId: string,
  userId: string,
): Promise<string[]> {
  const memberships = await prisma.agendaMember.findMany({
    where: {
      userId,
      agenda: scopeWhere(scopeType, scopeId),
    },
    select: { agendaId: true },
  });

  return memberships.map((m) => m.agendaId);
}

export async function userHasAnyAgendaAccess(
  scopeType: string,
  scopeId: string,
  userId: string,
): Promise<boolean> {
  const membershipCount = await prisma.agendaMember.count({
    where: {
      userId,
      agenda: scopeWhere(scopeType, scopeId),
    },
  });

  if (membershipCount > 0) {
    return true;
  }

  const participantCount = await prisma.agendaEventParticipant.count({
    where: {
      userId,
      event: { agenda: scopeWhere(scopeType, scopeId) },
    },
  });

  return participantCount > 0;
}
