'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod/v3';
import type {
  AnimalFollowUpMessageSide,
  AnimalFollowUpStatus,
} from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { animalsAccessAuth, animalsUpdateAuth } from '@/lib/animals/auth';
import {
  isFollowUpClosed,
  statusAfterMessage,
} from '@/lib/animals/followUpLabels';
import { fetchUserProfiles } from '@/lib/authUsers';
import { tenantRoutes } from '@/types/routes';

const dateOnlySchema = z.coerce.date();
const motifSchema = z.string().trim().min(1, 'Le motif est requis').max(255);
const recipientSchema = z.string().trim().min(1, 'Le destinataire est requis').max(120);
const bodySchema = z.string().trim().min(1, 'Le message est requis').max(20000);
const closureNoteSchema = z.string().trim().min(1, 'La note de clôture est requise').max(5000);

const statusSchema = z.enum([
  'initial',
  'awaiting_recipient',
  'no_reply',
  'awaiting_shelter',
  'cancelled',
  'validated',
  'refused',
]);

const closedStatusSchema = z.enum(['cancelled', 'validated', 'refused']);
const sideSchema = z.enum(['shelter', 'recipient']);

function toDateOnlyIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function revalidateAnimal(shelterSlug: string, animalId: string) {
  revalidatePath(tenantRoutes(shelterSlug).employee.animal(animalId));
}

function serializeMessage(row: {
  id: string;
  followUpId: string;
  side: AnimalFollowUpMessageSide;
  body: string;
  letterDate: Date;
  createdByUserId: string;
  createdAt: Date;
}) {
  return {
    ...row,
    letterDate: toDateOnlyIso(row.letterDate),
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeFollowUp(row: {
  id: string;
  animalId: string;
  shelterId: string;
  date: Date;
  motif: string;
  status: AnimalFollowUpStatus;
  conductedByUserId: string;
  recipientName: string;
  closureNote: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{
    id: string;
    followUpId: string;
    side: AnimalFollowUpMessageSide;
    body: string;
    letterDate: Date;
    createdByUserId: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: row.id,
    animalId: row.animalId,
    shelterId: row.shelterId,
    date: toDateOnlyIso(row.date),
    motif: row.motif,
    status: row.status,
    conductedByUserId: row.conductedByUserId,
    recipientName: row.recipientName,
    closureNote: row.closureNote,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: (row.messages ?? []).map(serializeMessage),
  };
}

async function requireAnimalInShelter(shelterId: string, animalId: string) {
  return prisma.animal.findFirst({
    where: { id: animalId, shelterId },
    select: { id: true, shelterId: true },
  });
}

async function requireFollowUpInShelter(shelterId: string, followUpId: string) {
  return prisma.animalFollowUp.findFirst({
    where: { id: followUpId, shelterId },
    include: {
      messages: { orderBy: [{ letterDate: 'asc' }, { createdAt: 'asc' }] },
    },
  });
}

export async function listAnimalFollowUps(shelterSlug: string, animalId: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsAccessAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const id = z.string().uuid().parse(animalId);

    const animal = await requireAnimalInShelter(shelterId, id);
    if (!animal) return { status: 404, error: 'Animal introuvable' };

    const rows = await prisma.animalFollowUp.findMany({
      where: { animalId: id, shelterId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        messages: { orderBy: [{ letterDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    const userIds = [
      ...rows.map((r) => r.conductedByUserId),
      ...rows.flatMap((r) => r.messages.map((m) => m.createdByUserId)),
    ];
    const profiles = await fetchUserProfiles(userIds);

    const data = rows.map((row) => ({
      ...serializeFollowUp(row),
      conductedByName: profiles.get(row.conductedByUserId)?.name ?? row.conductedByUserId,
      messages: row.messages.map((m) => ({
        ...serializeMessage(m),
        createdByName: profiles.get(m.createdByUserId)?.name ?? m.createdByUserId,
      })),
    }));

    return { status: 200, data };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des suivis');
  }
}

export async function createAnimalFollowUp(
  shelterSlug: string,
  data: {
    animalId: string;
    date: string | Date;
    motif: string;
    recipientName: string;
    conductedByUserId: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const animalId = z.string().uuid().parse(data.animalId);
    const date = dateOnlySchema.parse(data.date);
    const motif = motifSchema.parse(data.motif);
    const recipientName = recipientSchema.parse(data.recipientName);
    const conductedByUserId = z.string().min(1).parse(data.conductedByUserId);

    const animal = await requireAnimalInShelter(shelterId, animalId);
    if (!animal) return { status: 404, error: 'Animal introuvable' };

    const member = await prisma.shelterMember.findFirst({
      where: { shelterId, userId: conductedByUserId },
      select: { id: true },
    });
    if (!member) {
      return { status: 400, error: 'Le responsable doit être membre du refuge' };
    }

    const row = await prisma.animalFollowUp.create({
      data: {
        animalId,
        shelterId,
        date,
        motif,
        recipientName,
        conductedByUserId,
        status: 'initial',
      },
      include: {
        messages: { orderBy: [{ letterDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    const profiles = await fetchUserProfiles([row.conductedByUserId]);
    revalidateAnimal(shelterSlug, animalId);

    return {
      status: 201,
      data: {
        ...serializeFollowUp(row),
        conductedByName: profiles.get(row.conductedByUserId)?.name ?? row.conductedByUserId,
        messages: [],
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création du suivi');
  }
}

export async function updateAnimalFollowUpStatus(
  shelterSlug: string,
  data: { followUpId: string; status: AnimalFollowUpStatus },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const followUpId = z.string().uuid().parse(data.followUpId);
    const status = statusSchema.parse(data.status);

    const existing = await requireFollowUpInShelter(shelterId, followUpId);
    if (!existing) return { status: 404, error: 'Suivi introuvable' };

    if (isFollowUpClosed(status)) {
      return {
        status: 400,
        error: 'Utilisez la clôture pour valider, refuser ou annuler un suivi',
      };
    }

    const row = await prisma.animalFollowUp.update({
      where: { id: followUpId },
      data: {
        status,
        closureNote: null,
        closedAt: null,
      },
      include: {
        messages: { orderBy: [{ letterDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    const profiles = await fetchUserProfiles([
      row.conductedByUserId,
      ...row.messages.map((m) => m.createdByUserId),
    ]);
    revalidateAnimal(shelterSlug, row.animalId);

    return {
      status: 200,
      data: {
        ...serializeFollowUp(row),
        conductedByName: profiles.get(row.conductedByUserId)?.name ?? row.conductedByUserId,
        messages: row.messages.map((m) => ({
          ...serializeMessage(m),
          createdByName: profiles.get(m.createdByUserId)?.name ?? m.createdByUserId,
        })),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du statut');
  }
}

export async function closeAnimalFollowUp(
  shelterSlug: string,
  data: {
    followUpId: string;
    status: 'cancelled' | 'validated' | 'refused';
    closureNote: string;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const followUpId = z.string().uuid().parse(data.followUpId);
    const status = closedStatusSchema.parse(data.status);
    const closureNote = closureNoteSchema.parse(data.closureNote);

    const existing = await requireFollowUpInShelter(shelterId, followUpId);
    if (!existing) return { status: 404, error: 'Suivi introuvable' };

    const row = await prisma.animalFollowUp.update({
      where: { id: followUpId },
      data: {
        status,
        closureNote,
        closedAt: new Date(),
      },
      include: {
        messages: { orderBy: [{ letterDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    const profiles = await fetchUserProfiles([
      row.conductedByUserId,
      ...row.messages.map((m) => m.createdByUserId),
    ]);
    revalidateAnimal(shelterSlug, row.animalId);

    return {
      status: 200,
      data: {
        ...serializeFollowUp(row),
        conductedByName: profiles.get(row.conductedByUserId)?.name ?? row.conductedByUserId,
        messages: row.messages.map((m) => ({
          ...serializeMessage(m),
          createdByName: profiles.get(m.createdByUserId)?.name ?? m.createdByUserId,
        })),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la clôture du suivi');
  }
}

export async function addAnimalFollowUpMessage(
  shelterSlug: string,
  data: {
    followUpId: string;
    side: AnimalFollowUpMessageSide;
    body: string;
    letterDate: string | Date;
  },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, animalsUpdateAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;
    const userId = ctx.session.user.id;

    const followUpId = z.string().uuid().parse(data.followUpId);
    const side = sideSchema.parse(data.side);
    const body = bodySchema.parse(data.body);
    const letterDate = dateOnlySchema.parse(data.letterDate);

    const existing = await requireFollowUpInShelter(shelterId, followUpId);
    if (!existing) return { status: 404, error: 'Suivi introuvable' };
    if (isFollowUpClosed(existing.status)) {
      return { status: 400, error: 'Ce suivi est clos ; impossible d’ajouter une lettre' };
    }

    const nextStatus = statusAfterMessage(side);

    const row = await prisma.$transaction(async (tx) => {
      await tx.animalFollowUpMessage.create({
        data: {
          followUpId,
          side,
          body,
          letterDate,
          createdByUserId: userId,
        },
      });
      return tx.animalFollowUp.update({
        where: { id: followUpId },
        data: { status: nextStatus },
        include: {
          messages: { orderBy: [{ letterDate: 'asc' }, { createdAt: 'asc' }] },
        },
      });
    });

    const profiles = await fetchUserProfiles([
      row.conductedByUserId,
      ...row.messages.map((m) => m.createdByUserId),
    ]);
    revalidateAnimal(shelterSlug, row.animalId);

    return {
      status: 201,
      data: {
        ...serializeFollowUp(row),
        conductedByName: profiles.get(row.conductedByUserId)?.name ?? row.conductedByUserId,
        messages: row.messages.map((m) => ({
          ...serializeMessage(m),
          createdByName: profiles.get(m.createdByUserId)?.name ?? m.createdByUserId,
        })),
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’ajout de la lettre');
  }
}
