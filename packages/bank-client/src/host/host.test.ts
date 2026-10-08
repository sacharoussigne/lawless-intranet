import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod/v3';
import { ErrorWithStatus } from '@lawless-intranet/host-kit/errors';
import { createBankHostActions, type BankHostRun } from './index';

const server = vi.hoisted(() => ({
  getNameSuggestions: vi.fn(),
  addNameSuggestion: vi.fn(),
  createBankTransaction: vi.fn(),
}));
vi.mock('../server', () => server);

const scope = { scopeType: 'dispensary', scopeId: 'd1' };
const options = { cookieHeader: 'c=1' };

/** Test runner: no guard, errors surface as rejections. */
const run: BankHostRun = async (_slug, _fallback, call, successStatus = 200) => ({
  status: successStatus,
  data: await call(scope, options),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createBankHostActions', () => {
  it('merges company names with free-text suggestions, case-insensitively', async () => {
    server.getNameSuggestions.mockResolvedValue({ suggestions: ['acme', 'Loyer'] });
    const bank = createBankHostActions(run, { getCompanyNames: async () => ['ACME', '[12] Banque'] });
    await expect(bank.getNameSuggestions('slug')).resolves.toEqual({
      status: 200,
      data: {
        suggestions: ['acme', 'Loyer'],
        companyNames: ['ACME', '[12] Banque'],
        all: ['ACME', '[12] Banque', 'Loyer'],
      },
    });
  });

  it('keeps free-text suggestions as-is without company names', async () => {
    server.getNameSuggestions.mockResolvedValue({ suggestions: ['a', 'A'] });
    const result = await createBankHostActions(run).getNameSuggestions('slug');
    expect(result.data).toEqual({ suggestions: ['a', 'A'], companyNames: [], all: ['a', 'A'] });
  });

  it('rejects an empty suggestion with a 400 before calling the service', async () => {
    const bank = createBankHostActions(run);
    const error = await bank.addNameSuggestion('slug', { value: '  ' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorWithStatus);
    expect(error).toMatchObject({ statusCode: 400 });
    expect(server.addNameSuggestion).not.toHaveBeenCalled();
  });

  it('validates transactions and passes the scope, with a 201', async () => {
    server.createBankTransaction.mockResolvedValue({ id: 't1' });
    const bank = createBankHostActions(run);
    const data = {
      weekId: '7f1d1b9e-2c8a-4c11-9d7e-0a7b6d3c2e10',
      date: '2026-10-08',
      type: 'DEPOSIT' as const,
      name: 'Vente',
      amount: 12,
    };
    await expect(bank.createTransaction('slug', data)).resolves.toEqual({
      status: 201,
      data: { id: 't1' },
    });
    expect(server.createBankTransaction).toHaveBeenCalledWith({ ...scope, ...data }, options);

    await expect(bank.createTransaction('slug', { ...data, amount: -1 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});
