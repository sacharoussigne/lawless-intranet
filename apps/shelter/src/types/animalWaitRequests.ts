export type AnimalWaitRequestStatus = 'open' | 'fulfilled' | 'cancelled';

export type AnimalWaitRequestListItem = {
  id: string;
  shelterId: string;
  requestedAt: string;
  requesterName: string;
  speciesId: string;
  speciesName: string;
  breedId: string | null;
  breedName: string | null;
  comment: string | null;
  status: AnimalWaitRequestStatus;
  fulfilledAnimalId: string | null;
  fulfilledAnimalName: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type AnimalWaitRequestPreviewItem = {
  id: string;
  requestedAt: string;
  requesterName: string;
  speciesName: string;
  breedName: string | null;
};

export type OpenWaitRequestsPreview = {
  count: number;
  items: AnimalWaitRequestPreviewItem[];
};

export const ANIMAL_WAIT_REQUEST_STATUS_LABELS: Record<AnimalWaitRequestStatus, string> = {
  open: 'Ouverte',
  fulfilled: 'Honorée',
  cancelled: 'Annulée',
};
