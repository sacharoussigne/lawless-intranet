import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import { getAnimalDocument } from '@/app/_actions/animalDocuments';
import {
  listAnimalHistory,
  listAnimals,
  listCaseManagerOptions,
  listSpeciesOptions,
} from '@/app/_actions/animals';
import {
  listAnimalsForWaitlistLink,
  listAnimalWaitRequests,
  listOpenWaitRequestsPreview,
} from '@/app/_actions/animalWaitRequests';
import {
  getBankGlobalStats,
  getBankWeeks,
  getDescriptionSuggestions,
  getNameSuggestions,
  getPendingOccurrences,
  getPlannedTransactions,
} from '@/app/_actions/bankAccounts';
import { listAnimalFollowUps } from '@/app/_actions/followUps';
import {
  getMediaContents,
  getMediaLibraryDownloadUrl,
  getMediaTree,
  getMediaUserName,
} from '@/app/_actions/media';
import { listShelterMembers, searchUsersForShelterInvite } from '@/app/_actions/shelterMembers';
import { getShelterMemberPermissionOverrides } from '@/app/_actions/shelterPermissions';

/**
 * Reads exposed as GET (`/api/s/<slug>/read/<query>`) for client refetches.
 * Server actions run one at a time per tab, in the navigation queue; these run
 * in parallel. Each entry reuses the read action as-is: auth, tenant, feature
 * and permission checks stay in the action. Only the keys listed here exist.
 */
export const readRoutes = {
  // Waitlist (page and header indicator)
  waitRequests: (slug: string, input: Parameters<typeof listAnimalWaitRequests>[1]) =>
    listAnimalWaitRequests(slug, input),
  openWaitRequestsPreview: (slug: string, _input?: undefined) =>
    listOpenWaitRequestsPreview(slug),
  animalsForWaitlistLink: (slug: string, _input?: undefined) => listAnimalsForWaitlistLink(slug),

  // Animals
  animals: (slug: string, _input?: undefined) => listAnimals(slug),
  speciesOptions: (slug: string, _input?: undefined) => listSpeciesOptions(slug),
  caseManagerOptions: (slug: string, _input?: undefined) => listCaseManagerOptions(slug),
  animalHistory: (slug: string, input: { animalId: string }) =>
    listAnimalHistory(slug, input?.animalId),
  animalFollowUps: (slug: string, input: { animalId: string }) =>
    listAnimalFollowUps(slug, input?.animalId),
  animalDocument: (slug: string, input: { id: string; animalId: string }) =>
    getAnimalDocument(slug, input),

  // Bank (bank-ui, see lib/bank/bankUiActions; getOrCreateWeek writes, it stays an action)
  bankWeeks: (slug: string, _input?: undefined) => getBankWeeks(slug),
  bankNameSuggestions: (slug: string, _input?: undefined) => getNameSuggestions(slug),
  bankDescriptionSuggestions: (slug: string, _input?: undefined) => getDescriptionSuggestions(slug),
  bankPlannedTransactions: (slug: string, _input?: undefined) => getPlannedTransactions(slug),
  bankPendingOccurrences: (slug: string, _input?: undefined) => getPendingOccurrences(slug),
  bankGlobalStats: (slug: string, _input?: undefined) => getBankGlobalStats(slug),

  // Media library (media-ui, see lib/media/mediaUiActions)
  mediaContents: (slug: string, input: { folderId: string | null }) =>
    getMediaContents(slug, input?.folderId ?? null),
  mediaTree: (slug: string, _input?: undefined) => getMediaTree(slug),
  mediaDownloadUrl: (slug: string, input: { id: string }) =>
    getMediaLibraryDownloadUrl(slug, input?.id),
  mediaUserName: (slug: string, input: { userId: string }) => getMediaUserName(slug, input?.userId),

  // Shelter admin
  shelterMembers: (slug: string, _input?: undefined) => listShelterMembers(slug),
  memberInviteUserSearch: (slug: string, input: { query: string }) =>
    searchUsersForShelterInvite(slug, input?.query),
  memberPermissionOverrides: (slug: string, input: { userId: string }) =>
    getShelterMemberPermissionOverrides(slug, input?.userId),
} satisfies ReadRegistry;

export type ReadRoutes = typeof readRoutes;
