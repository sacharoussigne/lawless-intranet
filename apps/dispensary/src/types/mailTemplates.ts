import type { MailTemplate, MailTemplateListItem } from '@/types/mails';

export type { MailTemplate, MailTemplateListItem };

export type OrderMailTemplateAssignment = {
  id: string;
  dispensaryId: string;
  orderType: string;
  orderStatus: string;
  templateId: string;
  createdAt: Date;
  updatedAt: Date;
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
