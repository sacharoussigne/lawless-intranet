import type { CompanyRecord } from '@lawless-intranet/types';

export type CompanySelect = Pick<CompanyRecord, 'id' | 'name'>;

export type CompanyWithRelations = CompanyRecord;
