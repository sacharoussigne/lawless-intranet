import { describe, expect, it } from 'vitest';
import { summarizeBotResponse } from './botRoute';

describe('summarizeBotResponse', () => {
  it('keeps errors as they are', () => {
    expect(summarizeBotResponse({ status: 403, error: 'Fonction désactivée' })).toEqual({
      status: 403,
      error: 'Fonction désactivée',
    });
  });

  it('keeps flags and ids of a weekday flag result', () => {
    expect(
      summarizeBotResponse({
        status: 200,
        data: { alreadyDone: true, message: 'Déjà enregistrée', activity: { id: 'a1', chestDays: {} } },
      }),
    ).toEqual({ status: 200, alreadyDone: true, message: 'Déjà enregistrée', activityId: 'a1' });
  });

  it('reduces lists to their size', () => {
    expect(summarizeBotResponse({ status: 200, data: [{}, {}] })).toEqual({ status: 200, count: 2 });
  });
});
