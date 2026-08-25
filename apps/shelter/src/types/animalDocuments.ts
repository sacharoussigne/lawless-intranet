export type AnimalDocumentTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  defaultDocumentName: string | null;
  shelterId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AnimalDocumentListItem = {
  id: string;
  name: string;
  content: string;
  contentPreview: string;
  shelterId: string;
  animalId: string;
  templateId: string | null;
  source: 'template' | 'freeText';
  createdAt: Date;
  updatedAt: Date;
};
