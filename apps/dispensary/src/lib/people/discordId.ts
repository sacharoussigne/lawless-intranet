import { z } from 'zod/v3';

/** A Discord user id (snowflake): 17 to 20 digits. */
export const DISCORD_USER_ID_PATTERN = /^\d{17,20}$/;

export function isDiscordUserId(value: string): boolean {
  return DISCORD_USER_ID_PATTERN.test(value);
}

export const discordUserIdSchema = z
  .string()
  .trim()
  .regex(DISCORD_USER_ID_PATTERN, 'Discord ID invalide (17 à 20 chiffres)');
