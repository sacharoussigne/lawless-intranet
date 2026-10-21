import type { CabinetAccessLevel } from '@prisma/client';

export type CabinetMemberUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export type CabinetMemberDTO = {
  id: string;
  userId: string;
  accessLevel: CabinetAccessLevel;
  user: CabinetMemberUser;
};

export type CabinetSummaryDTO = {
  id: string;
  name: string;
  description: string | null;
  accessLevel: CabinetAccessLevel | null;
  memberCount: number;
  patientCount?: number;
};

export type CabinetPatientSummaryDTO = {
  id: string;
  cabinetId: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  emergencyContact: string | null;
  careEpisodeCount: number;
};

export type CareEpisodeSummaryDTO = {
  id: string;
  patientId: string;
  motif: string;
  startedAt: Date;
  consultationCount: number;
  createdAt: Date;
};

export type ConsultationSummaryDTO = {
  id: string;
  careEpisodeId: string;
  date: Date;
  createdAt: Date;
};

export const CABINET_ACCESS_LEVELS: CabinetAccessLevel[] = ['OWNER', 'WRITE', 'READ'];

export function cabinetAccessLevelLabel(level: CabinetAccessLevel): string {
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

export function canReadCabinet(level: CabinetAccessLevel | null | undefined): boolean {
  return level === 'OWNER' || level === 'WRITE' || level === 'READ';
}

export function canWriteCabinet(level: CabinetAccessLevel | null | undefined): boolean {
  return level === 'OWNER' || level === 'WRITE';
}

export function canOwnCabinet(level: CabinetAccessLevel | null | undefined): boolean {
  return level === 'OWNER';
}
