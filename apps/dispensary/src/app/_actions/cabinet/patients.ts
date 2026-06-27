'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import type { CabinetPatientSummaryDTO } from '@/types/cabinet';
import {
  createPatientSchema,
  updatePatientSchema,
  deletePatientSchema,
  listPatientsSchema,
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

export async function listCabinetPatients(
  dispensarySlug: string,
  data: { cabinetId: string; search?: string },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = listPatientsSchema.parse(data);

    const guard = await guardCabinetRead(
      ctx.tenant.dispensaryId,
      validated.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const search = validated.search?.trim();

    const patients = await prisma.cabinetPatient.findMany({
      where: {
        cabinetId: validated.cabinetId,
        cabinet: tenantWhere(ctx.tenant.dispensaryId),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { careEpisodes: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const result: CabinetPatientSummaryDTO[] = patients.map((p) => ({
      id: p.id,
      cabinetId: p.cabinetId,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate,
      emergencyContact: p.emergencyContact,
      careEpisodeCount: p._count.careEpisodes,
    }));

    return { status: 200, data: result };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement des patients');
  }
}

export async function getCabinetPatient(dispensarySlug: string, patientId: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const patient = await prisma.cabinetPatient.findFirst({
      where: {
        id: patientId,
        cabinet: tenantWhere(ctx.tenant.dispensaryId),
      },
      include: {
        cabinet: { select: { id: true, name: true, formSchemas: true, displaySettings: true } },
        _count: { select: { careEpisodes: true } },
      },
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

    return {
      status: 200,
      data: {
        ...patient,
        customValues: parseCustomValuesFromDb(patient.customValues),
        formSchemas: parseCabinetFormSchemas(patient.cabinet.formSchemas),
        displaySettings: parseCabinetDisplaySettings(patient.cabinet.displaySettings),
        accessLevel: guard.accessLevel,
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement du patient');
  }
}

export async function createCabinetPatient(
  dispensarySlug: string,
  data: {
    cabinetId: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    emergencyContact?: string | null;
    customValues?: Record<string, string | null>;
  },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = createPatientSchema.parse(data);

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      validated.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const cabinet = await prisma.cabinet.findFirst({
      where: { id: validated.cabinetId, ...tenantWhere(ctx.tenant.dispensaryId) },
      select: { formSchemas: true },
    });
    if (!cabinet) {
      return { status: 404, error: 'Cabinet introuvable' };
    }

    const schemas = parseCabinetFormSchemas(cabinet.formSchemas);
    const entitySchema = getEntitySchema(schemas, 'patient');
    const customValidation = validateCustomValues(
      entitySchema,
      validated.customValues ?? {},
      { enforceRequired: false },
    );
    if (!customValidation.ok) {
      return customValidationToActionError(customValidation.fieldErrors);
    }

    const patient = await prisma.cabinetPatient.create({
      data: {
        cabinetId: validated.cabinetId,
        firstName: validated.firstName,
        lastName: validated.lastName,
        birthDate: validated.birthDate ? new Date(validated.birthDate) : null,
        emergencyContact: validated.emergencyContact ?? null,
        customValues: customValidation.values as object,
      },
    });

    return { status: 201, data: patient };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la création du patient');
  }
}

export async function updateCabinetPatient(
  dispensarySlug: string,
  data: {
    id: string;
    cabinetId: string;
    firstName: string;
    lastName: string;
    birthDate?: string | null;
    emergencyContact?: string | null;
    customValues?: Record<string, string | null>;
  },
) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = updatePatientSchema.parse(data);

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      validated.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    const existing = await prisma.cabinetPatient.findFirst({
      where: {
        id: validated.id,
        cabinetId: validated.cabinetId,
        cabinet: tenantWhere(ctx.tenant.dispensaryId),
      },
      include: { cabinet: { select: { formSchemas: true } } },
    });
    if (!existing) {
      return { status: 404, error: 'Patient introuvable' };
    }

    const schemas = parseCabinetFormSchemas(existing.cabinet.formSchemas);
    const entitySchema = getEntitySchema(schemas, 'patient');
    const customValidation = validateCustomValues(
      entitySchema,
      validated.customValues ?? {},
    );
    if (!customValidation.ok) {
      return customValidationToActionError(customValidation.fieldErrors);
    }

    const patient = await prisma.cabinetPatient.update({
      where: { id: validated.id },
      data: {
        firstName: validated.firstName,
        lastName: validated.lastName,
        birthDate: validated.birthDate ? new Date(validated.birthDate) : null,
        emergencyContact: validated.emergencyContact ?? null,
        customValues: customValidation.values as object,
      },
    });

    return { status: 200, data: patient };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la mise à jour du patient');
  }
}

export async function deleteCabinetPatient(dispensarySlug: string, id: string) {
  try {
    const ctx = await getCabinetSessionContext(dispensarySlug);
    if (!ctx.ok) return ctx.response;

    const validated = deletePatientSchema.parse({ id });

    const existing = await prisma.cabinetPatient.findFirst({
      where: {
        id: validated.id,
        cabinet: tenantWhere(ctx.tenant.dispensaryId),
      },
      select: { cabinetId: true },
    });
    if (!existing) {
      return { status: 404, error: 'Patient introuvable' };
    }

    const guard = await guardCabinetWrite(
      ctx.tenant.dispensaryId,
      existing.cabinetId,
      ctx.session,
      ctx.tenant.effectiveRole,
    );
    if (!guard.ok) {
      return { status: guard.status, error: guard.error };
    }

    await prisma.cabinetPatient.delete({ where: { id: validated.id } });

    return { status: 200 };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression du patient');
  }
}
