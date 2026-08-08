import type { CompanyRecord } from '@lawless-intranet/types';

export type CompanySelect = Pick<CompanyRecord, 'id' | 'name'>;

export type CompanyGroupMembership = NonNullable<CompanyRecord['companyGroups']>[number];

export type CompanyWithRelations = CompanyRecord;
