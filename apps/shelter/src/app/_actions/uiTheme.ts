'use server';

import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { actionErrorParser } from '@/lib/action';
import { requireSession } from '@/lib/serverActionAuth';
import { isShelterThemeId, SHELTER_THEME_CONFIG } from '@/lib/themes';

const themeIdSchema = z.string().refine(isShelterThemeId, 'Thème inconnu');

/** Theme saved in the user's account (default theme when never chosen). */
export async function getMyTheme() {
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) return sessionResult.response;

    const prefs = await prisma.userUiPreferences.findUnique({
      where: { userId: sessionResult.session.user.id },
      select: { theme: true },
    });
    const theme = prefs?.theme && isShelterThemeId(prefs.theme) ? prefs.theme : SHELTER_THEME_CONFIG.defaultThemeId;
    return { status: 200, data: theme };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors du chargement du thème');
  }
}

export async function setMyTheme(themeId: string) {
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) return sessionResult.response;

    const theme = themeIdSchema.parse(themeId);
    const userId = sessionResult.session.user.id;
    await prisma.userUiPreferences.upsert({
      where: { userId },
      create: { userId, theme },
      update: { theme },
    });
    return { status: 200, data: theme };
  } catch (error) {
    return actionErrorParser(error, 'Erreur lors de l’enregistrement du thème');
  }
}
