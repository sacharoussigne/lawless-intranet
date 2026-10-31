import { z } from 'zod/v3';
import type { AppLogEntry } from './types';

/** Discord interaction (click, modal, command) a bot log line belongs to: one id for the whole click. */
export const BOT_INTERACTION_ID_HEADER = 'x-bot-interaction-id';

/** Body over this size (characters) is refused: the bot never sends that much. */
export const MAX_BOT_CLIENT_LOG_LENGTH = 20_000;

const SNOWFLAKE = /^\d{15,25}$/;

const serializedError: z.ZodType<{
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: unknown;
}> = z.lazy(() =>
  z.object({
    name: z.string().max(200),
    message: z.string().max(2_000),
    code: z.string().max(100).optional(),
    stack: z.string().max(4_000).optional(),
    cause: serializedError.optional(),
  }),
);

/** What the bot reports when something goes wrong on its side (the intranet never saw it). */
export const botClientLogSchema = z.object({
  level: z.enum(['WARN', 'ERROR']),
  /** `interaction.expired`, `interaction.slow`, `api.unreachable`, `api.timeout`, `api.invalidResponse`, `bot.exception`… */
  event: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z][\w.-]*$/, 'Événement invalide'),
  message: z.string().min(1).max(500),
  feature: z.enum(['weeklyActivity', 'payroll', 'platform']).default('weeklyActivity'),
  interaction: z
    .object({
      id: z.string().regex(SNOWFLAKE).optional(),
      /** Button / modal `customId`, or `/command`. */
      action: z.string().max(200).optional(),
      /** Click → received by the bot (gateway lag). */
      ageMs: z.number().int().min(0).max(3_600_000).optional(),
      /** Click → acknowledgement sent (Discord gives up at 3 s). */
      ackMs: z.number().int().min(0).max(3_600_000).optional(),
      /** Time spent computing the screen (API calls included). */
      workMs: z.number().int().min(0).max(3_600_000).optional(),
    })
    .optional(),
  api: z
    .object({
      method: z.string().max(10).optional(),
      path: z.string().max(500),
      httpStatus: z.number().int().min(0).max(999).optional(),
      durationMs: z.number().int().min(0).max(3_600_000).optional(),
    })
    .optional(),
  error: serializedError.optional(),
});

export type BotClientLog = z.infer<typeof botClientLogSchema>;

/** Log line of a bot-side error, attached to the click (`targetId`) and to the member. */
export function botClientLogEntry(
  log: BotClientLog,
  who: { businessId: string | null; discordUserId: string | null },
): AppLogEntry {
  return {
    level: log.level,
    kind: 'ERROR',
    feature: log.feature,
    event: `bot.client.${log.event}`,
    outcome: 'failure',
    message: `Bot : ${log.message}`,
    source: 'DISCORD_BOT',
    businessId: who.businessId,
    discordUserId: who.discordUserId,
    httpStatus: log.api?.httpStatus ?? null,
    durationMs: log.interaction?.ackMs ?? log.api?.durationMs ?? null,
    path: log.api?.path ?? null,
    targetId: log.interaction?.id ?? null,
    context: { interaction: log.interaction, api: log.api },
    error: log.error,
  };
}

/** Interaction id sent by the bot with its API calls, if it looks like a Discord id. */
export function interactionIdFromHeaders(headers: Headers): string | null {
  const id = headers.get(BOT_INTERACTION_ID_HEADER)?.trim();
  return id && SNOWFLAKE.test(id) ? id : null;
}
