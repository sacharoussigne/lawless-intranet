import type { MailTemplate, MailTemplateListItem } from '@/types/mails';
import type { OrderMailAssignmentRecord } from '@lawless-intranet/types';

export type { MailTemplate, MailTemplateListItem };

export type OrderMailTemplateAssignment = OrderMailAssignmentRecord & {
  mailTemplate?: {
    id: string;
    name: string;
  } | null;
};

export type OrderMailTemplateAssignmentWithTemplate = OrderMailTemplateAssignment & {
  mailTemplate: {
    id: string;
    name: string;
  } | null;
};
