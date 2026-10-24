import { NextResponse } from 'next/server';
import { z } from 'zod';
import dayjs from '@/lib/dayjs';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { publicBusinessOrigin } from '@/lib/business/hosts';
import { isBusinessBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/businessWeeklyActivityApiAuth';
import { resolveBotBusinessContext } from '@/lib/businessWeeklyActivity/botRequestContext';
import { jsonBotError } from '@/lib/businessWeeklyActivity/botRouteHandlers';
import { withBotRouteLog } from '@/lib/logs/botRoute';
import {
  PAYROLL_CAISSE_SALE_USD,
  PAYROLL_OFFERED_ITEM_USD,
  PAYROLL_REPORT_TYPE_EMPLOYES,
} from '@/lib/payroll/constants';
import { createPayrollReport, EMPTY_PARSED_PAYROLL_TABLE } from '@/lib/payroll/createReport';
import { resolvePayrollDefaultRates } from '@/lib/payroll/salaryTypes';
import { accountIdOfDiscord } from '@/lib/people/accountLinks';
import { tenantRoutes } from '@/types/routes';

const PARIS_TZ = 'Europe/Paris';

/** `YYYY-MM-DD` that exists in the calendar (no 31 February). */
function isCalendarDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const bodySchema = z.object({
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date doit être au format YYYY-MM-DD')
    .refine(isCalendarDate, 'date invalide')
    .optional(),
});

/**
 * Bot only: creates the « Employés » payroll report of the week of `date` (Paris, default today),
 * filled from the weekly activity. An existing report of that week is returned instead of a 409.
 */
async function handlePost(request: Request) {
  const req = request as Parameters<typeof isBusinessBotApiAuthorized>[0];
  if (!isBusinessBotApiAuthorized(req)) {
    return jsonBotError(401, 'Non autorisé');
  }
  const businessCtx = await resolveBotBusinessContext(req);
  if (!businessCtx.ok) {
    return jsonBotError(businessCtx.status, businessCtx.error);
  }
  const payrollBlock = await getAppFeatureActionBlock(businessCtx.businessId, 'payroll');
  if (payrollBlock) {
    return jsonBotError(payrollBlock.status, payrollBlock.error);
  }

  const discordUserId = getDiscordUserIdFromBotRequest(req);
  if (!discordUserId) {
    return jsonBotError(400, 'En-tête X-Discord-User-Id requis');
  }

  const text = await request.text();
  let body: unknown = {};
  if (text.trim() !== '') {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonBotError(400, 'Corps JSON invalide');
    }
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonBotError(422, parsed.error.issues[0]?.message ?? 'Données invalides');
  }

  const date = parsed.data.date ?? dayjs().tz(PARIS_TZ).format('YYYY-MM-DD');
  // No account linked (or auth service down): the author stays identifiable by its Discord id.
  const createdById = (await accountIdOfDiscord(discordUserId)) ?? `discord:${discordUserId}`;
  const rates = await resolvePayrollDefaultRates(businessCtx.businessId);

  const created = await createPayrollReport({
    businessId: businessCtx.businessId,
    businessType: businessCtx.businessType,
    weekStartStr: date,
    reportType: PAYROLL_REPORT_TYPE_EMPLOYES,
    parsed: EMPTY_PARSED_PAYROLL_TABLE,
    importWeeklyActivity: true,
    prices: {
      caissePriceUsd: rates.caisseUnitUsd,
      caisseSalePriceUsd: PAYROLL_CAISSE_SALE_USD,
      patientCarePriceUsd: rates.patientCareUsd,
      offeredItemPriceUsd: PAYROLL_OFFERED_ITEM_USD,
    },
    createdById,
  });
  if (created.status === 500) {
    return jsonBotError(500, 'Échec de la création du rapport');
  }

  const alreadyExists = created.status === 409;
  const id = alreadyExists ? created.existingId : created.data.id;
  const { weekStart, weekEnd } = alreadyExists ? created : created.data;
  const url = `${publicBusinessOrigin(businessCtx.businessType)}${tenantRoutes(businessCtx.businessSlug).employee.payrollDetail(id)}`;

  return NextResponse.json({
    status: 200,
    data: {
      id,
      url,
      reportType: PAYROLL_REPORT_TYPE_EMPLOYES,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      alreadyExists,
    },
  });
}

export const POST = withBotRouteLog({ feature: 'payroll', event: 'bot.payroll.create' }, handlePost);
