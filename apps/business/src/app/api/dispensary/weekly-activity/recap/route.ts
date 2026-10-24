import { withBotRouteLog } from '@/lib/logs/botRoute';
import { NextResponse } from 'next/server';
import { toBotApiRow } from '@/lib/businessWeeklyActivity/botApiRow';
import type { NextRequest } from 'next/server';
import { isBusinessBotApiAuthorized, getDiscordUserIdFromBotRequest } from '@/lib/businessWeeklyActivityApiAuth';
import { listSerializedWeeklyActivities } from '@/lib/businessWeeklyActivity/listSerialized';
import { getBankWeekBounds } from '@/lib/bankWeek';
import { resolveBotBusinessContext } from '@/lib/businessWeeklyActivity/botRequestContext';
import dayjs from '@/lib/dayjs';
import { attachBotSalaryEstimates } from '@/lib/payroll/botSalaryEstimate';

function jsonError(status: number, error: string) {
  return NextResponse.json({ status, error }, { status });
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

async function handleGet(request: NextRequest) {
  if (!isBusinessBotApiAuthorized(request)) {
    return jsonError(401, 'Non autorisé');
  }

  const businessCtx = await resolveBotBusinessContext(request);
  if (!businessCtx.ok) {
    return jsonError(businessCtx.status, businessCtx.error);
  }

  const dateParam = request.nextUrl.searchParams.get('date')?.trim() ?? '';
  if (!YMD.test(dateParam)) {
    return jsonError(400, 'Paramètre date requis (YYYY-MM-DD, calendrier Europe/Paris)');
  }

  const anchorParis = dayjs.tz(dateParam, 'YYYY-MM-DD', 'Europe/Paris').startOf('day');
  if (!anchorParis.isValid()) {
    return jsonError(400, 'Date invalide');
  }

  const { start: periodStart, end: periodEnd } = getBankWeekBounds(anchorParis.toDate());
  const optionalDiscord = getDiscordUserIdFromBotRequest(request);

  const overlapWhere = {
    businessId: businessCtx.businessId,
    periodStart: { lte: periodEnd },
    periodEnd: { gte: periodStart },
    ...(optionalDiscord ? { discordUserId: optionalDiscord } : {}),
  };

  const rows = await listSerializedWeeklyActivities(
    overlapWhere,
    businessCtx.businessId,
    [{ displayName: 'asc' }, { discordUserId: 'asc' }],
  );

  const sorted = [...rows].sort((a, b) =>
    a.resolvedDisplayName.localeCompare(b.resolvedDisplayName, 'fr', { sensitivity: 'base' }),
  );

  // Estimated pay of each row (null without the payroll module); the bot shows the team's to the Direction only.
  const withSalary = await attachBotSalaryEstimates(
    businessCtx.businessId,
    businessCtx.businessType,
    sorted,
  );

  return NextResponse.json({
    status: 200,
    data: {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      rows: withSalary.map(({ salary, ...row }) => ({
        ...toBotApiRow(row, businessCtx.businessType),
        salary,
      })),
    },
  });
}

export const GET = withBotRouteLog(
  { feature: 'weeklyActivity', event: 'bot.weeklyActivity.recap' },
  handleGet,
);
