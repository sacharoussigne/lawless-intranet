'use server';

import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { tenantWhere } from '@/lib/dispensary/tenantWhere';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import { formatCompanyBankName } from '@/lib/bank/companyName';
import {
  addDescriptionSuggestion as addDescriptionSuggestionApi,
  addNameSuggestion as addNameSuggestionApi,
  deleteDescriptionSuggestion as deleteDescriptionSuggestionApi,
  deleteNameSuggestion as deleteNameSuggestionApi,
  getDescriptionSuggestions as getDescriptionSuggestionsApi,
  getNameSuggestions as getNameSuggestionsApi,
} from '@lawless-intranet/bank-client/server';

export async function getNameSuggestions(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const [bankSuggestions, companies] = await Promise.all([
      getNameSuggestionsApi(bankScope(dispensaryId), await bankCookie()),
      prisma.company.findMany({
        where: tenantWhere(dispensaryId),
        select: { name: true, bankAccountNumber: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const companyNames = companies.map(formatCompanyBankName);
    const freeText = bankSuggestions.suggestions;
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
    try {
      return bankActionError(error, 'Erreur lors de la récupération des suggestions de noms');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la récupération des suggestions de noms');
    }
  }
}

export async function getDescriptionSuggestions(dispensarySlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(dispensarySlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { dispensaryId } = ctx.tenant;

    const suggestions = await getDescriptionSuggestionsApi(
      bankScope(dispensaryId),
      await bankCookie(),
    );
    return { status: 200, data: suggestions };
  } catch (error) {
    try {
      return bankActionError(
        error,
        'Erreur lors de la récupération des suggestions de descriptions',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la récupération des suggestions de descriptions',
      );
    }
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

    const value = await addNameSuggestionApi(
      { ...bankScope(dispensaryId), value: data.value },
      await bankCookie(),
    );
    return { status: 201, data: value };
  } catch (error) {
    try {
      return bankActionError(error, "Erreur lors de l'ajout de la suggestion de nom");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de l'ajout de la suggestion de nom");
    }
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

    const value = await addDescriptionSuggestionApi(
      { ...bankScope(dispensaryId), value: data.value },
      await bankCookie(),
    );
    return { status: 201, data: value };
  } catch (error) {
    try {
      return bankActionError(error, "Erreur lors de l'ajout de la suggestion de description");
    } catch (e) {
      return actionErrorParser(e, "Erreur lors de l'ajout de la suggestion de description");
    }
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

    await deleteNameSuggestionApi(
      { ...bankScope(dispensaryId), value: data.value },
      await bankCookie(),
    );
    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return bankActionError(error, 'Erreur lors de la suppression de la suggestion de nom');
    } catch (e) {
      return actionErrorParser(e, 'Erreur lors de la suppression de la suggestion de nom');
    }
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

    await deleteDescriptionSuggestionApi(
      { ...bankScope(dispensaryId), value: data.value },
      await bankCookie(),
    );
    return { status: 200, data: { success: true } };
  } catch (error) {
    try {
      return bankActionError(
        error,
        'Erreur lors de la suppression de la suggestion de description',
      );
    } catch (e) {
      return actionErrorParser(
        e,
        'Erreur lors de la suppression de la suggestion de description',
      );
    }
  }
}
