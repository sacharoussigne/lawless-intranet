import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod/v3';
import { ServiceClientError } from '@lawless-intranet/service-client';
import {
  createActionErrorParser,
  getDataOrThrow,
  handleAction,
  toUiResult,
} from './action';
import { ForbiddenError, NotFoundError, ParsedZodError } from './errors';
import { serviceActionError } from './serviceError';

const actionErrorParser = createActionErrorParser((error: ZodError) =>
  error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
);

describe('actionErrorParser', () => {
  it('maps Zod errors to 422 field errors', () => {
    const result = z.object({ name: z.string() }).safeParse({});
    expect(result.success).toBe(false);
    const parsed = actionErrorParser(result.success ? null : result.error);
    expect(parsed.status).toBe(422);
    expect(parsed.error).toEqual([{ field: 'name', message: 'Required' }]);
  });

  it('keeps the status of ErrorWithStatus and defaults to 500', () => {
    expect(actionErrorParser(new ForbiddenError('Non'))).toEqual({ status: 403, error: 'Non' });
    expect(actionErrorParser(new Error('Boom'))).toEqual({ status: 500, error: 'Boom' });
    expect(actionErrorParser('oops', 'Réessayez')).toEqual({ status: 500, error: 'Réessayez' });
  });
});

describe('handleAction', () => {
  it('returns data or throws a typed error', () => {
    expect(handleAction({ status: 200, data: 1 })).toBe(1);
    expect(() => handleAction({ status: 404 })).toThrow(NotFoundError);
    expect(() => handleAction({ status: 403, error: 'Non' })).toThrow(ForbiddenError);
    expect(() =>
      handleAction({ status: 422, error: [{ field: 'name', message: 'Requis' }] }),
    ).toThrow(ParsedZodError);
    expect(() => handleAction({ status: 500, error: 'Boom' })).toThrow('Boom');
  });
});

describe('getDataOrThrow', () => {
  it('returns falsy data but rejects missing data', () => {
    expect(getDataOrThrow({ status: 200, data: 0 })).toBe(0);
    expect(() => getDataOrThrow({ status: 200, data: null })).toThrow('Aucune donnée disponible');
    expect(() => getDataOrThrow({ status: 404, error: 'Introuvable' })).toThrow(NotFoundError);
  });
});

describe('toUiResult', () => {
  it('keeps data and joins field errors', async () => {
    await expect(toUiResult(Promise.resolve({ status: 200, data: 'ok' }))).resolves.toEqual({
      status: 200,
      data: 'ok',
    });
    await expect(
      toUiResult(
        Promise.resolve({
          status: 422,
          error: [
            { field: 'a', message: 'A' },
            { field: 'b', message: 'B' },
          ],
        }),
      ),
    ).resolves.toEqual({ status: 422, error: 'A, B' });
  });
});

describe('serviceActionError', () => {
  it('uses the service status, otherwise the app parser', () => {
    expect(serviceActionError(new ServiceClientError('Interdit', 403), 'x', actionErrorParser)).toEqual({
      status: 403,
      error: 'Interdit',
    });
    expect(serviceActionError('oops', 'Échec', actionErrorParser)).toEqual({
      status: 500,
      error: 'Échec',
    });
  });
});
