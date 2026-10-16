/** A person of the dispensary, keyed by Discord ID, with or without an intranet account. */
export type DispensaryPerson = {
  discordUserId: string;
  /** Name shown everywhere: fixed name, otherwise the latest name sent by the bot. */
  displayName: string;
  fixedDisplayName: string | null;
  lastDisplayName: string;
  role: string | null;
  accountNumber: number | null;
  /** Intranet account holding this Discord ID, if any. */
  account: { id: string; name: string } | null;
  updatedAt: Date;
};

/** Dispensary member with Discord who has no profile yet. */
export type MemberWithoutProfile = {
  userId: string;
  name: string;
  discordUserId: string;
};

export type DispensaryPeopleList = {
  people: DispensaryPerson[];
  membersWithoutProfile: MemberWithoutProfile[];
};
