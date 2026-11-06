import { describe, expect, it } from 'vitest';
import { botClientLogEntry, botClientLogSchema, interactionIdFromHeaders } from './botClientLog';

const who = { businessId: 'b1', discordUserId: '645464350332551208' };

describe('botClientLogSchema', () => {
  it('accepts a late acknowledgement with its timings', () => {
    const parsed = botClientLogSchema.parse({
      level: 'ERROR',
      event: 'interaction.expired',
      message: 'Accusé de réception trop tard (10062)',
      interaction: { id: '1432145678901234567', action: 'disp:dash:chest:off', ageMs: 400, ackMs: 3100, workMs: 2900 },
      error: { name: 'DiscordAPIError', message: 'Unknown interaction', code: '10062' },
    });
    expect(parsed.feature).toBe('weeklyActivity');
    expect(parsed.interaction?.ackMs).toBe(3100);
  });

  it('refuses an unknown level, a malformed event or a too long message', () => {
    const base = { level: 'ERROR', event: 'bot.exception', message: 'x' };
    expect(botClientLogSchema.safeParse({ ...base, level: 'INFO' }).success).toBe(false);
    expect(botClientLogSchema.safeParse({ ...base, event: 'drop table;' }).success).toBe(false);
    expect(botClientLogSchema.safeParse({ ...base, message: 'x'.repeat(501) }).success).toBe(false);
  });

  it('refuses an interaction id that is not a Discord id', () => {
    expect(
      botClientLogSchema.safeParse({
        level: 'WARN',
        event: 'interaction.slow',
        message: 'Lent',
        interaction: { id: 'abc' },
      }).success,
    ).toBe(false);
  });
});

describe('botClientLogEntry', () => {
  it('writes a bot error line attached to the click and the member', () => {
    const entry = botClientLogEntry(
      botClientLogSchema.parse({
        level: 'ERROR',
        event: 'api.unreachable',
        message: 'Le serveur du dispensaire ne répond pas',
        interaction: { id: '1432145678901234567', action: 'disp:dash:open' },
        api: { method: 'GET', path: '/api/dispensary/weekly-activity/recap', durationMs: 8000 },
        error: { name: 'TypeError', message: 'fetch failed', cause: { name: 'Error', message: 'connect ECONNREFUSED', code: 'ECONNREFUSED' } },
      }),
      who,
    );
    expect(entry).toMatchObject({
      level: 'ERROR',
      kind: 'ERROR',
      source: 'DISCORD_BOT',
      event: 'bot.client.api.unreachable',
      outcome: 'failure',
      businessId: 'b1',
      discordUserId: '645464350332551208',
      targetId: '1432145678901234567',
      path: '/api/dispensary/weekly-activity/recap',
      durationMs: 8000,
    });
    expect(entry.error).toMatchObject({ cause: { code: 'ECONNREFUSED' } });
  });
});

describe('interactionIdFromHeaders', () => {
  it('reads a Discord id and ignores anything else', () => {
    expect(interactionIdFromHeaders(new Headers({ 'x-bot-interaction-id': '1432145678901234567' }))).toBe(
      '1432145678901234567',
    );
    expect(interactionIdFromHeaders(new Headers({ 'x-bot-interaction-id': 'nope' }))).toBeNull();
    expect(interactionIdFromHeaders(new Headers())).toBeNull();
  });
});
