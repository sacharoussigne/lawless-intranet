'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { bankActionAuth } from '@/lib/bank/auth';
import { formatCompanyBankName } from '@/lib/bank/companyName';

export async function getNameSuggestions(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const [suggestions, companies] = await Promise.all([
      prisma.transactionNameSuggestion.findMany({
        where: tenantWhere(dispensaryId),
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.company.findMany({
        where: tenantWhere(dispensaryId),
        select: { name: true, bankAccountNumber: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const companyNames = companies.map(formatCompanyBankName);
    const freeText = suggestions.map((s) => s.value);
    const merged = [...companyNames];
    for (const value of freeText) {
      if (!merged.some((v) => v.toLowerCase() === value.toLowerCase())) {
        merged.push(value);
      }
    }

    return {
      status: 200,
      data: {
        suggestions: freeText,
        companyNames,
        all: merged,
      },
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des suggestions de noms');
  }
}

export async function getDescriptionSuggestions(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const suggestions = await prisma.transactionDescriptionSuggestion.findMany({
      where: tenantWhere(dispensaryId),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      status: 200,
      data: suggestions.map((s) => s.value),
    };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la récupération des suggestions de descriptions');
  }
}

export async function addNameSuggestion(dispensarySlug: string, data: { value: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'Le nom ne peut pas être vide' };
    }

    const trimmedValue = data.value.trim();
    const suggestion = await prisma.transactionNameSuggestion.upsert({
      where: {
        dispensaryId_value: { dispensaryId, value: trimmedValue },
      },
      update: {},
      create: { dispensaryId, value: trimmedValue },
    });

    return { status: 201, data: suggestion.value };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de l'ajout de la suggestion de nom");
  }
}

export async function addDescriptionSuggestion(
  dispensarySlug: string,
  data: { value: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'La description ne peut pas être vide' };
    }

    const trimmedValue = data.value.trim();
    const suggestion = await prisma.transactionDescriptionSuggestion.upsert({
      where: {
        dispensaryId_value: { dispensaryId, value: trimmedValue },
      },
      update: {},
      create: { dispensaryId, value: trimmedValue },
    });

    return { status: 201, data: suggestion.value };
  } catch (error) {
    return actionErrorParser(error, "Erreur lors de l'ajout de la suggestion de description");
  }
}

export async function deleteNameSuggestion(dispensarySlug: string, data: { value: string }) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'Le nom ne peut pas être vide' };
    }

    await prisma.transactionNameSuggestion.deleteMany({
      where: {
        dispensaryId,
        value: data.value.trim(),
      },
    });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la suggestion de nom');
  }
}

export async function deleteDescriptionSuggestion(
  dispensarySlug: string,
  data: { value: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'La description ne peut pas être vide' };
    }

    await prisma.transactionDescriptionSuggestion.delete({
      where: {
        dispensaryId_value: { dispensaryId, value: data.value.trim() },
      },
    });

    return { status: 200, data: { success: true } };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de la suppression de la suggestion de description');
  }
}
