'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import type { ConsultationSummaryDTO } from '@/types/cabinet';
import {
  createConsultationSchema,
  updateConsultationSchema,
  deleteConsultationSchema,
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

export async function listConsultations(dispensarySlug: string, careEpisodeId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const episode = await prisma.careEpisode.findFirst({
      where: {
        id: careEpisodeId,
        patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) },
      },
      select: { patient: { select: { cabinetId: true } } },
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

    const consultations = await prisma.consultation.findMany({
      where: { careEpisodeId },
      orderBy: { date: 'desc' },
    });

    const result: ConsultationSummaryDTO[] = consultations.map((c) => ({
      id: c.id,
      careEpisodeId: c.careEpisodeId,
      date: c.date,
      createdAt: c.createdAt,
    }));

    return { status: 200, data: result };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des consultations');
  }
}

export async function getConsultation(dispensarySlug: string, consultationId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const consultation = await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        careEpisode: { patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) } },
      },
      include: {
        careEpisode: {
          select: {
            id: true,
            motif: true,
            startedAt: true,
            patientId: true,
            customValues: true,
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                birthDate: true,
                cabinetId: true,
                customValues: true,
                cabinet: { select: { name: true, formSchemas: true, displaySettings: true } },
              },
            },
          },
        },
      },
    });

    if (!consultation) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      consultation.careEpisode.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    return {
      status: 200,
      data: {
        ...consultation,
        customValues: parseCustomValuesFromDb(consultation.customValues),
        careEpisode: {
          ...consultation.careEpisode,
          customValues: parseCustomValuesFromDb(consultation.careEpisode.customValues),
          patient: {
            ...consultation.careEpisode.patient,
            customValues: parseCustomValuesFromDb(consultation.careEpisode.patient.customValues),
          },
        },
        formSchemas: parseCabinetFormSchemas(
          consultation.careEpisode.patient.cabinet.formSchemas,
        ),
        displaySettings: parseCabinetDisplaySettings(
          consultation.careEpisode.patient.cabinet.displaySettings,
        ),
        accessLevel: guard.accessLevel,
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement de la consultation');
  }
}

export async function createConsultation(
  dispensarySlug: string,
  data: {
    careEpisodeId: string;
    date: string;
    customValues?: Record<string, string | null>;
  },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createConsultationSchema.parse(data);

    const episode = await prisma.careEpisode.findFirst({
      where: {
        id: validated.careEpisodeId,
        patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) },
      },
      include: {
        patient: { select: { cabinetId: true, cabinet: { select: { formSchemas: true } } } },
      },
    });
    if (!episode) {
      return { status: 404, error: 'Prise en charge introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      episode.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const schemas = parseCabinetFormSchemas(episode.patient.cabinet.formSchemas);
    const entitySchema = getEntitySchema(schemas, 'consultation');
    const customValidation = validateCustomValues(
      entitySchema,
      validated.customValues ?? {},
    );
    if (!customValidation.ok) {
      return customValidationToActionError(customValidation.fieldErrors);
    }

    const consultation = await prisma.consultation.create({
      data: {
        careEpisodeId: validated.careEpisodeId,
        date: new Date(validated.date),
        customValues: customValidation.values as object,
      },
    });

    return { status: 201, data: consultation };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création de la consultation');
  }
}

export async function updateConsultation(
  dispensarySlug: string,
  data: {
    id: string;
    careEpisodeId: string;
    date: string;
    customValues?: Record<string, string | null>;
  },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updateConsultationSchema.parse(data);

    const existing = await prisma.consultation.findFirst({
      where: {
        id: validated.id,
        careEpisodeId: validated.careEpisodeId,
        careEpisode: { patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) } },
      },
      include: {
        careEpisode: {
          select: {
            patient: { select: { cabinetId: true, cabinet: { select: { formSchemas: true } } } },
          },
        },
      },
    });
    if (!existing) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      existing.careEpisode.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const schemas = parseCabinetFormSchemas(existing.careEpisode.patient.cabinet.formSchemas);
    const entitySchema = getEntitySchema(schemas, 'consultation');
    const customValidation = validateCustomValues(
      entitySchema,
      validated.customValues ?? {},
    );
    if (!customValidation.ok) {
      return customValidationToActionError(customValidation.fieldErrors);
    }

    const consultation = await prisma.consultation.update({
      where: { id: validated.id },
      data: {
        date: new Date(validated.date),
        customValues: customValidation.values as object,
      },
    });

    return { status: 200, data: consultation };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour de la consultation');
  }
}

export async function deleteConsultation(dispensarySlug: string, id: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deleteConsultationSchema.parse({ id });

    const existing = await prisma.consultation.findFirst({
      where: {
        id: validated.id,
        careEpisode: { patient: { cabinet: tenantWhere(ctx.tenant.dispensaryId) } },
      },
      select: {
        careEpisode: { select: { patient: { select: { cabinetId: true } } } },
      },
    });
    if (!existing) {
      return { status: 404, error: 'Consultation introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      existing.careEpisode.patient.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    await prisma.consultation.delete({ where: { id: validated.id } });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la consultation');
  }
}
