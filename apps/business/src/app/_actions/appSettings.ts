'use server';

import { loggedAction } from '@/lib/logs/writer';
import { revalidatePath } from 'next/cache';
import { updateTag } from 'next/cache';
import { z } from 'zod/v3';
import prisma from '@/lib/prisma';
import { MAX_RP_YEAR_OFFSET, MIN_RP_YEAR_OFFSET } from '@lawless-intranet/types';
import { actionErrorParser } from '@/lib/action';
import {
  appSettingsCacheTag,
  getAppSettings,
  type AppSettingsDTO,
} from '@/lib/appSettings';
import { requireBusinessAdminContext } from '@/lib/business/serverActionContext';
import { businessBase } from '@/types/routes';
import { isReservedBusinessSlug, RESERVED_BUSINESS_SLUG_MESSAGE } from '@/lib/business/slug';
import {
  parseWeeklyCounterSettings,
  weeklyCounterDefinitions,
} from '@/lib/businessWeeklyActivity/counters';

export type BusinessSettingsAdminDTO = AppSettingsDTO & {
  slug: string;
};

const slugSchema = z
  .string()
  .trim()
  .min(1, 'Le slug est requis')
  .max(80, 'Le slug est trop long')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug invalide (lettres minuscules, chiffres et tirets)')
  .refine((slug) => !isReservedBusinessSlug(slug), RESERVED_BUSINESS_SLUG_MESSAGE);

const rpYearOffsetSchema = z
  .number({ invalid_type_error: "L'écart du calendrier RP est requis" })
  .int("L'écart du calendrier RP doit être un nombre entier d'années")
  .min(MIN_RP_YEAR_OFFSET, `L'écart du calendrier RP doit être d'au moins ${MIN_RP_YEAR_OFFSET} an`)
  .max(MAX_RP_YEAR_OFFSET, `L'écart du calendrier RP ne peut pas dépasser ${MAX_RP_YEAR_OFFSET} ans`);

const updateSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(120, 'Le nom est trop long'),
  slug: slugSchema,
  featureStockEnabled: z.boolean(),
  featureBankEnabled: z.boolean(),
  featureOrdersEnabled: z.boolean(),
  featureSearchEnabled: z.boolean(),
  featureMailsEnabled: z.boolean(),
  featurePayrollEnabled: z.boolean(),
  featureWeeklyActivityEnabled: z.boolean(),
  featureAgendaEnabled: z.boolean(),
  featureCabinetEnabled: z.boolean(),
  featureSalesEnabled: z.boolean(),
  featureMediaEnabled: z.boolean(),
  weeklyActivityChestDaysVisible: z.boolean(),
  weeklyActivityPresenceDaysVisible: z.boolean(),
  weeklyActivityCounters: z.record(z.string(), z.boolean()),
  rpYearOffset: rpYearOffsetSchema,
});

export async function getAppSettingsForAdmin(
  businessSlug: string,
): Promise<
  | { status: 200; data: BusinessSettingsAdminDTO }
  | { status: number; error: string }
> {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }

    const settings = await getAppSettings(auth.ctx.businessId);
    const data: BusinessSettingsAdminDTO = {
      ...settings,
      slug: auth.ctx.business.slug,
    };
    return { status: 200, data };
  } catch (error) {
    const parsed = actionErrorParser(
      error,
      'Erreur lors du chargement des paramètres',
    );
    return {
      status: 500,
      error:
        typeof parsed.error === 'string'
          ? parsed.error
          : 'Erreur lors du chargement des paramètres',
    };
  }
}

async function updateAppSettingsUnlogged(
  businessSlug: string,
  input: z.infer<typeof updateSchema>,
): Promise<
  | { status: 200; data: BusinessSettingsAdminDTO }
  | { status: number; error: string }
> {
  try {
    const auth = await requireBusinessAdminContext(businessSlug);
    if (!auth.ok) {
      return { status: auth.status, error: auth.error };
    }
    const { businessId, business } = auth.ctx;

    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 400,
        error: parsed.error.issues[0]?.message ?? 'Données invalides',
      };
    }

    // Only the counters of the business type, and only the turned-off ones (a missing key is enabled).
    const counterSettings = Object.fromEntries(
      weeklyCounterDefinitions(business.type)
        .filter((c) => parsed.data.weeklyActivityCounters[c.key] === false)
        .map((c) => [c.key, false]),
    );

    const newSlug = parsed.data.slug;
    if (newSlug !== business.slug) {
      const taken = await prisma.business.findFirst({
        where: { slug: newSlug, id: { not: businessId } },
        select: { id: true },
      });
      if (taken) {
        return { status: 409, error: 'Ce slug est déjà utilisé par une autre entreprise' };
      }
    }

    const [, row] = await prisma.$transaction([
      prisma.business.update({
        where: { id: businessId },
        data: {
          name: parsed.data.businessName,
          slug: newSlug,
        },
      }),
      prisma.appSettings.upsert({
        where: { businessId },
        create: {
          businessId,
          businessName: parsed.data.businessName,
          featureStockEnabled: parsed.data.featureStockEnabled,
          featureBankEnabled: parsed.data.featureBankEnabled,
          featureOrdersEnabled: parsed.data.featureOrdersEnabled,
          featureSearchEnabled: parsed.data.featureSearchEnabled,
          featureMailsEnabled: parsed.data.featureMailsEnabled,
          featurePayrollEnabled: parsed.data.featurePayrollEnabled,
          featureWeeklyActivityEnabled:
            parsed.data.featureWeeklyActivityEnabled,
          featureAgendaEnabled: parsed.data.featureAgendaEnabled,
          featureCabinetEnabled: parsed.data.featureCabinetEnabled,
          featureSalesEnabled: parsed.data.featureSalesEnabled,
          featureMediaEnabled: parsed.data.featureMediaEnabled,
          weeklyActivityChestDaysVisible: parsed.data.weeklyActivityChestDaysVisible,
          weeklyActivityPresenceDaysVisible: parsed.data.weeklyActivityPresenceDaysVisible,
          weeklyActivityCounters: counterSettings,
          rpYearOffset: parsed.data.rpYearOffset,
        },
        update: {
          businessName: parsed.data.businessName,
          featureStockEnabled: parsed.data.featureStockEnabled,
          featureBankEnabled: parsed.data.featureBankEnabled,
          featureOrdersEnabled: parsed.data.featureOrdersEnabled,
          featureSearchEnabled: parsed.data.featureSearchEnabled,
          featureMailsEnabled: parsed.data.featureMailsEnabled,
          featurePayrollEnabled: parsed.data.featurePayrollEnabled,
          featureWeeklyActivityEnabled:
            parsed.data.featureWeeklyActivityEnabled,
          featureAgendaEnabled: parsed.data.featureAgendaEnabled,
          featureCabinetEnabled: parsed.data.featureCabinetEnabled,
          featureSalesEnabled: parsed.data.featureSalesEnabled,
          featureMediaEnabled: parsed.data.featureMediaEnabled,
          weeklyActivityChestDaysVisible: parsed.data.weeklyActivityChestDaysVisible,
          weeklyActivityPresenceDaysVisible: parsed.data.weeklyActivityPresenceDaysVisible,
          weeklyActivityCounters: counterSettings,
          rpYearOffset: parsed.data.rpYearOffset,
        },
      }),
    ]);

    updateTag(appSettingsCacheTag(businessId));
    revalidatePath(businessBase(business.slug), 'layout');
    if (newSlug !== business.slug) {
      revalidatePath(businessBase(newSlug), 'layout');
    }
    revalidatePath('/platform/dispensaries');

    const data: BusinessSettingsAdminDTO = {
      businessType: business.type,
      businessName: row.businessName,
      slug: newSlug,
      featureStockEnabled: row.featureStockEnabled,
      featureBankEnabled: row.featureBankEnabled,
      featureOrdersEnabled: row.featureOrdersEnabled,
      featureSearchEnabled: row.featureSearchEnabled,
      featureMailsEnabled: row.featureMailsEnabled,
      featurePayrollEnabled: row.featurePayrollEnabled,
      featureWeeklyActivityEnabled: row.featureWeeklyActivityEnabled,
      featureAgendaEnabled: row.featureAgendaEnabled ?? true,
      featureCabinetEnabled: row.featureCabinetEnabled ?? true,
      featureSalesEnabled: row.featureSalesEnabled ?? true,
      featureMediaEnabled: row.featureMediaEnabled ?? true,
      weeklyActivityChestDaysVisible: row.weeklyActivityChestDaysVisible ?? true,
      weeklyActivityPresenceDaysVisible: row.weeklyActivityPresenceDaysVisible ?? true,
      weeklyActivityCounters: parseWeeklyCounterSettings(row.weeklyActivityCounters),
      payrollPatientCareUsd: Number(row.payrollPatientCareUsd),
      rpYearOffset: row.rpYearOffset,
    };

    return { status: 200, data };
  } catch (error) {
    const parsed = actionErrorParser(
      error,
      'Erreur lors de la mise à jour des paramètres',
    );
    return {
      status: 500,
      error:
        typeof parsed.error === 'string'
          ? parsed.error
          : 'Erreur lors de la mise à jour des paramètres',
    };
  }
}

/* Every mutation is logged, whatever the outcome (docs/APP-LOGS.md). */

export async function updateAppSettings(...args: Parameters<typeof updateAppSettingsUnlogged>) {
  return loggedAction({ feature: 'settings', event: 'appSettings.updateAppSettings' }, args, () =>
    updateAppSettingsUnlogged(...args),
  );
}
