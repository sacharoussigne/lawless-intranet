import type {
  AnimalFollowUpMessageSide,
  AnimalFollowUpStatus,
} from '@/generated/prisma/client';

export type FollowUpMessageDTO = {
  id: string;
  followUpId: string;
  side: AnimalFollowUpMessageSide;
  body: string;
  letterDate: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
};

export type FollowUpDTO = {
  id: string;
  animalId: string;
  shelterId: string;
  date: string;
  motif: string;
  status: AnimalFollowUpStatus;
  conductedByUserId: string;
  conductedByName: string;
  recipientName: string;
  closureNote: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: FollowUpMessageDTO[];
};
