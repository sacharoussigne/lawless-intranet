import type { BankHostRun } from '@lawless-intranet/bank-client/host';
import { bankActionAuth } from '@/lib/bank/auth';
import { serviceHost } from '@/lib/serviceHost';
import { withTenantService } from '@/lib/serviceAction';

export const BANK_SCOPE_TYPE = serviceHost.scopeType;
export const bankScope = serviceHost.scope;
export const bankCookie = serviceHost.cookie;

/** Guarded bank call for the current tenant (see `createBankHostActions`). */
export const withBank: BankHostRun = (slug, fallback, call, successStatus) =>
  withTenantService(
    slug,
    bankActionAuth,
    fallback,
    async (tenantId) => call(bankScope(tenantId), await bankCookie()),
    successStatus,
  );
