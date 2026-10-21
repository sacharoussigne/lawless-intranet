export type ConsultationDocumentTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  defaultDocumentName: string | null;
  cabinetId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ConsultationDocumentListItem = {
  id: string;
  name: string;
  content: string;
  contentPreview: string;
  cabinetId: string;
  patientId: string;
  careEpisodeId: string;
  consultationId: string;
  templateId: string | null;
  source: 'template' | 'freeText';
  createdAt: Date;
  updatedAt: Date;
};
