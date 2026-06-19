export type Mail = {
  id: string;
  dispensaryId: string;
  senderId: string;
  name: string;
  receiver: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MailTemplate = {
  id: string;
  dispensaryId: string;
  name: string;
  description: string | null;
  content: string;
  defaultMailName: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MailListItem = {
  id: string;
  name: string;
  receiver: string;
  createdAt: Date;
  contentPreview: string;
};

export type MailsPageFilters = {
  page: number;
  pageSize: number;
  nameSearch?: string;
  receiverSearch?: string;
};

export type MailsPageResult = {
  items: MailListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type MailTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  defaultMailName: string | null;
  createdAt: Date;
  updatedAt: Date;
  dispensaryId?: string;
  userId?: string | null;
};

export type MailTemplatesPageFilters = {
  page: number;
  pageSize: number;
  nameSearch?: string;
};

export type MailTemplatesPageResult = {
  items: MailTemplateListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type MailTemplateOption = {
  id: string;
  name: string;
};

export type DocumentAccessItem = {
  id: string;
  userId: string;
  accessType: 'READ' | 'WRITE';
  createdAt: string;
  updatedAt: string;
};
