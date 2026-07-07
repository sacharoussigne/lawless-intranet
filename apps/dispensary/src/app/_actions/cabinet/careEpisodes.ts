'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import type { CareEpisodeSummaryDTO } from '@/types/cabinet';
import {
  createCareEpisodeSchema,
  updateCareEpisodeSchema,
  deleteCareEpisodeSchema,
} from '@/app/_actions/cabinet/schemas';
import {
  getCabinetSessionContext,
  guardCabinetRead,
  guardCabinetWrite,
} from '@/app/_actions/cabinet/internals';
import { customValidationToActionError } from '@/lib/cabinet/customValidationActionError';
import {
  getEntitySchema,
  parseCabinetFormSchemas,
  parseCustomValuesFromDb,
  validateCustomValues,
} from '@/lib/cabinet/formSchema';
import { parseCabinetDisplaySettings } from '@/lib/cabinet/displaySettings';

export async function listCareEpisodes(dispensarySlug: string, patientId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const patient = await prisma.cabinetPatient.findFirst({
      where: {
        id: patientId,
        cabinet: tenantWhere(ctx.tenant.dispensaryId),
      },
      select: { cabinetId: true },
    });
    if (!patient) {
      return { status: 404, error: 'Patient introuvable' };
    }

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const episodes = await prisma.careEpisode.findMany({
      where: { patientId },
      include: { _count: { select: { consultations: true } } },
      orderBy: { startedAt: 'desc' },
    });

    const result: CareEpisodeSummaryDTO[] = episodes.map((e) => ({
      id: e.id,
      patientId: e.patientId,
      motif: e.motif,
      startedAt: e.startedAt,
      consultationCount: e._count.consultations,
      createdAt: e.createdAt,
    }));

    return { status: 200, data: result };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des prises en charge');
  }
}

export async function getCareEpisode(dispensarySlug: string, episodeId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const episode = await prisma.careEpisode.findFirst({
      where: {
        id: episodeId,
        patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            cabinetId: true,
            cabinet: { select: { formSchemas: true, displaySettings: true } },
          },
        },
        _count: { select: { consultations: true } },
      },
    });

    if (!episode) {
      return { status: 404, error: 'Prise en charge introuvable' };
    }

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      episode.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    return {
      status: 200,
      data: {
        ...episode,
        customValues: parseCustomValuesFromDb(episode.customValues),
        formSchemas: parseCabinetFormSchemas(episode.patient.cabinet.formSchemas),
        displaySettings: parseCabinetDisplaySettings(episode.patient.cabinet.displaySettings),
        accessLevel: guard.accessLevel,
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de la prise en charge');
  }
}

export async function createCareEpisode(
  dispensarySlug: string,
  data: {
    patientId: string;
    motif: string;
    startedAt: string;
    customValues?: Record<string, string | null>;
  },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createCareEpisodeSchema.parse(data);

    const patient = await prisma.cabinetPatient.findFirst({
      where: {
        id: validated.patientId,
        cabinet: tenantWhere(ctx.tenant.dispensaryId),
      },
      include: { cabinet: { select: { formSchemas: true } } },
    });
    if (!patient) {
      return { status: 404, error: 'Patient introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const schemas = parseCabinetFormSchemas(patient.cabinet.formSchemas);
    const entitySchema = getEntitySchema(schemas, 'careEpisode');
    const customValidation = validateCustomValues(
      entitySchema,
      validated.customValues ?? {},
      { enforceRequired: false },
    );
    if (!customValidation.ok) {
      return customValidationToActionError(customValidation.fieldErrors);
    }

    const episode = await prisma.careEpisode.create({
      data: {
        patientId: validated.patientId,
        motif: validated.motif,
        startedAt: new Date(validated.startedAt),
        customValues: customValidation.values as object,
      },
    });

    return { status: 201, data: episode };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la prise en charge');
  }
}

export async function updateCareEpisode(
  dispensarySlug: string,
  data: {
    id: string;
    patientId: string;
    motif: string;
    startedAt: string;
    customValues?: Record<string, string | null>;
  },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateCareEpisodeSchema.parse(data);

    const existing = await prisma.careEpisode.findFirst({
      where: {
        id: validated.id,
        patientId: validated.patientId,
        patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) },
      },
      include: {
        patient: { select: { cabinetId: true, cabinet: { select: { formSchemas: true } } } },
      },
    });
    if (!existing) {
      return { status: 404, error: 'Prise en charge introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      existing.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const schemas = parseCabinetFormSchemas(existing.patient.cabinet.formSchemas);
    const entitySchema = getEntitySchema(schemas, 'careEpisode');
    const customValidation = validateCustomValues(
      entitySchema,
      validated.customValues ?? {},
    );
    if (!customValidation.ok) {
      return customValidationToActionError(customValidation.fieldErrors);
    }

    const episode = await prisma.careEpisode.update({
      where: { id: validated.id },
      data: {
        motif: validated.motif,
        startedAt: new Date(validated.startedAt),
        customValues: customValidation.values as object,
      },
    });

    return { status: 200, data: episode };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la prise en charge');
  }
}

export async function deleteCareEpisode(dispensarySlug: string, id: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteCareEpisodeSchema.parse({ id });

    const existing = await prisma.careEpisode.findFirst({
      where: {
        id: validated.id,
        patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) },
      },
      select: { patient: { select: { cabinetId: true } } },
    });
    if (!existing) {
      return { status: 404, error: 'Prise en charge introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      existing.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    await prisma.careEpisode.delete({ where: { id: validated.id } });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la prise en charge');
  }
}
