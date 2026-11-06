import type { LetterBoxAccessLevel, LetterDirection } from '@prisma/client';

export type { LetterBoxAccessLevel, LetterDirection };

export type LetterBoxMemberDTO = {
  userId: string;
  accessLevel: LetterBoxAccessLevel;
  name: string;
  image: string | null;
};

/** A box as seen by the current user (with their own access level). */
export type LetterBoxSummaryDTO = {
  id: string;
  name: string;
  description: string | null;
  accessLevel: LetterBoxAccessLevel;
};

export type LetterBoxAdminDTO = {
  id: string;
  name: string;
  description: string | null;
  members: LetterBoxMemberDTO[];
  letterCount: number;
};

export type LetterCorrespondentDTO = {
  id: string;
  name: string;
  note: string | null;
  lastLetterAt: Date | null;
  letterCount: number;
  lastLetter: { title: string; direction: LetterDirection } | null;
};

export type LetterImageDTO = {
  id: string;
  mediaFileId: string;
  name: string;
  mimeType: string;
  size: number;
  /** Signed inline URL (1 h); null when the media service could not sign it. */
  previewUrl: string | null;
};

export type LetterReplyRefDTO = {
  id: string;
  serial: string;
  title: string;
  direction: LetterDirection;
};

export type LetterDTO = {
  id: string;
  correspondentId: string;
  direction: LetterDirection;
  serial: string;
  title: string;
  transcript: string | null;
  letterDate: Date;
  archivedAt: Date | null;
  createdAt: Date;
  createdBy: { id: string; name: string };
  replyTo: LetterReplyRefDTO | null;
  images: LetterImageDTO[];
};

/** Hit of the global search: enough to open the conversation on the letter. */
export type LetterSearchHitDTO = {
  id: string;
  correspondentId: string;
  correspondentName: string;
  direction: LetterDirection;
  serial: string;
  title: string;
  letterDate: Date;
  archived: boolean;
  /** Part of the transcript around the match, when the match is in the transcript. */
  excerpt: string | null;
  /** `text`: the typed words are in the letter; `meaning`: close by meaning only (embeddings). */
  match: 'text' | 'meaning';
};

export const LETTER_BOX_ACCESS_LEVELS: LetterBoxAccessLevel[] = ['OWNER', 'WRITE', 'READ'];

export function letterBoxAccessLevelLabel(level: LetterBoxAccessLevel): string {
  switch (level) {
    case 'OWNER':
      return 'Propriétaire';
    case 'WRITE':
      return 'Écriture';
    case 'READ':
      return 'Lecture';
    default:
      return level;
  }
}

export function letterDirectionLabel(direction: LetterDirection): string {
  return direction === 'RECEIVED' ? 'Reçue' : 'Envoyée';
}

export function canReadLetterBox(level: LetterBoxAccessLevel | null | undefined): boolean {
  return level === 'OWNER' || level === 'WRITE' || level === 'READ';
}

export function canWriteLetterBox(level: LetterBoxAccessLevel | null | undefined): boolean {
  return level === 'OWNER' || level === 'WRITE';
}

export function canOwnLetterBox(level: LetterBoxAccessLevel | null | undefined): boolean {
  return level === 'OWNER';
}
