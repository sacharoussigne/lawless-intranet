'use server';

import { actionErrorParser } from '@/lib/action';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { bankActionAuth } from '@/lib/bank/auth';
import { bankActionError, bankCookie, bankScope } from '@/lib/bank/client';
import {
  addDescriptionSuggestion as addDescriptionSuggestionApi,
  addNameSuggestion as addNameSuggestionApi,
  deleteDescriptionSuggestion as deleteDescriptionSuggestionApi,
  deleteNameSuggestion as deleteNameSuggestionApi,
  getDescriptionSuggestions as getDescriptionSuggestionsApi,
  getNameSuggestions as getNameSuggestionsApi,
} from '@lawless-intranet/bank-client/server';

export async function getNameSuggestions(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const bankSuggestions = await getNameSuggestionsApi(
      bankScope(shelterId),
      await bankCookie(),
    );
    const freeText = bankSuggestions.suggestions;

    return {
      status: 200,
      data: {
        suggestions: freeText,
        companyNames: [] as string[],
        all: freeText,
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

export async function getDescriptionSuggestions(shelterSlug: string) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    const suggestions = await getDescriptionSuggestionsApi(
      bankScope(shelterId),
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

export async function addNameSuggestion(shelterSlug: string, data: { value: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'Le nom ne peut pas être vide' };
    }

    const value = await addNameSuggestionApi(
      { ...bankScope(shelterId), value: data.value },
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
  shelterSlug: string,
  data: { value: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'La description ne peut pas être vide' };
    }

    const value = await addDescriptionSuggestionApi(
      { ...bankScope(shelterId), value: data.value },
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

export async function deleteNameSuggestion(shelterSlug: string, data: { value: string }) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'Le nom ne peut pas être vide' };
    }

    await deleteNameSuggestionApi(
      { ...bankScope(shelterId), value: data.value },
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
  shelterSlug: string,
  data: { value: string },
) {
  try {
    const ctx = await requireTenantServerActionContext(shelterSlug, bankActionAuth);
    if (!ctx.ok) return ctx.response;
    const { shelterId } = ctx.tenant;

    if (!data.value || data.value.trim().length === 0) {
      return { status: 400, error: 'La description ne peut pas être vide' };
    }

    await deleteDescriptionSuggestionApi(
      { ...bankScope(shelterId), value: data.value },
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
