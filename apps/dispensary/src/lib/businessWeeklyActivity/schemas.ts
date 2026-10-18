import { z } from 'zod';
import { DISCORD_USER_ID_PATTERN } from '@/lib/people/discordId';
import { WEEKDAY_KEYS, weekdayFlagsSchema } from '@/lib/businessWeeklyActivity/weekdayFlags';

const parisDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Format de date attendu : YYYY-MM-DD',
});

const botDayEditFieldsSchema = z.object({
  weekday: z.enum(WEEKDAY_KEYS).optional(),
  date: parisDateSchema.optional(),
  value: z.boolean().optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
});

function refineBotDayEditExclusive(d: { weekday?: string; date?: string; value?: boolean }) {
  const hasWeekday = d.weekday !== undefined;
  const hasDate = d.date !== undefined;
  const hasValue = d.value !== undefined;
  const isEdit = hasWeekday || hasDate || hasValue;

  if (!isEdit) return true;

  if (hasWeekday && hasDate) {
    return false;
  }
  if (!hasWeekday && !hasDate) {
    return false;
  }
  return hasValue;
}

export const businessWeeklyActivityBotCaisseBodySchema = botDayEditFieldsSchema.refine(
  refineBotDayEditExclusive,
  {
    message:
      'Pour éditer une caisse : indiquez value et exactement un de weekday ou date (pas les deux).',
  },
);

export const businessWeeklyActivityBotPresenceBodySchema = z
  .object({
    day: z.enum(['today', 'yesterday']).optional(),
    weekday: z.enum(WEEKDAY_KEYS).optional(),
    date: parisDateSchema.optional(),
    value: z.boolean().optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (d) => {
      const legacyDay = d.day !== undefined;
      const hasWeekday = d.weekday !== undefined;
      const hasDate = d.date !== undefined;
      const hasValue = d.value !== undefined;
      const isEdit = hasWeekday || hasDate || hasValue;

      if (legacyDay && isEdit) {
        return false;
      }
      if (legacyDay) {
        return true;
      }
      return refineBotDayEditExclusive(d);
    },
    {
      message:
        'Utilisez day (today/yesterday) seul, ou value avec exactement un de weekday ou date (sans mélanger).',
    },
  );

/** Counter values by key (lib/businessTypes `weeklyCounters`); the keys are checked against the business type. */
export const weeklyCountersSchema = z.record(z.string().min(1).max(40), z.number().int().min(0));

/** One field per counter, as the existing Discord bots send them (mapped to `counters` by the routes). */
const legacyCounterFieldsSchema = z.object({
  sherifCount: z.number().int().min(0).optional(),
  patientsCount: z.number().int().min(0).optional(),
  infusionsCount: z.number().int().min(0).optional(),
  poppyMilkCount: z.number().int().min(0).optional(),
});

export const businessWeeklyActivityMetricsSchema = z.object({
  counters: weeklyCountersSchema.optional(),
  chestDays: weekdayFlagsSchema.optional(),
  presenceDays: weekdayFlagsSchema.optional(),
});

export const businessWeeklyActivityCreateSchema = z
  .object({
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    displayName: z.string().trim().min(1).max(200),
    discordUserId: z.string().trim().regex(DISCORD_USER_ID_PATTERN, 'Discord ID invalide (17 à 20 chiffres)'),
    userId: z.string().trim().min(1).optional().nullable(),
  })
  .merge(businessWeeklyActivityMetricsSchema)
  .refine((d) => d.periodEnd.getTime() >= d.periodStart.getTime(), {
    message: 'La fin de période doit être après le début',
    path: ['periodEnd'],
  });

export const businessWeeklyActivityUpdateSchema = businessWeeklyActivityMetricsSchema
  .partial()
  .extend({
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (d) => {
      if (d.periodStart !== undefined && d.periodEnd !== undefined) {
        return d.periodEnd.getTime() >= d.periodStart.getTime();
      }
      return true;
    },
    { message: 'La fin de période doit être après le début', path: ['periodEnd'] },
  );

/** Bot `POST …/weekly-activity`: the create body, counters also accepted through their legacy fields. */
export const businessWeeklyActivityBotCreateSchema = businessWeeklyActivityCreateSchema.and(
  legacyCounterFieldsSchema,
);

/** Bot `PATCH …/[id]` : counters (absolute values) and meta only (caisse / présence via routes dédiées). */
export const businessWeeklyActivityBotPatchSchema = legacyCounterFieldsSchema
  .extend({
    counters: weeklyCountersSchema.optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (d) => {
      if (d.periodStart !== undefined && d.periodEnd !== undefined) {
        return d.periodEnd.getTime() >= d.periodStart.getTime();
      }
      return true;
    },
    { message: 'La fin de période doit être après le début', path: ['periodEnd'] },
  );

export type BusinessWeeklyActivityBotCaisseBody = z.infer<
  typeof businessWeeklyActivityBotCaisseBodySchema
>;
export type BusinessWeeklyActivityBotPresenceBody = z.infer<
  typeof businessWeeklyActivityBotPresenceBodySchema
>;

export type BusinessWeeklyActivityCreateInput = z.infer<typeof businessWeeklyActivityCreateSchema>;
export type BusinessWeeklyActivityUpdateInput = z.infer<typeof businessWeeklyActivityUpdateSchema>;
export type BusinessWeeklyActivityBotPatchInput = z.infer<typeof businessWeeklyActivityBotPatchSchema>;
