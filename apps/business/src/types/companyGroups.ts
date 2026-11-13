import type { CompanyGroupRecord, CompanyRecord } from '@lawless-intranet/types';

export type CompanyGroupWithRelations = CompanyGroupRecord;

export type CompanyGroupForOrders = {
  id: string;
  name: string;
  companies: {
    company: Pick<CompanyRecord, 'id' | 'name'>;
  }[];
};
