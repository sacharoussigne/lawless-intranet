/** A person of the dispensary, keyed by Discord ID, with or without an intranet account. */
export type BusinessPerson = {
  discordUserId: string;
  /** Name shown everywhere: fixed name, otherwise the latest name sent by the bot. */
  displayName: string;
  fixedDisplayName: string | null;
  lastDisplayName: string;
  role: string | null;
  accountNumber: number | null;
  /** Salary type in this business (payroll); null = the business default. */
  salaryType: { id: string; label: string } | null;
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

/** Salary type offered in Gestion › Personnes. */
export type SalaryTypeOption = { id: string; label: string; caisseUnitUsd: number; isDefault: boolean };

export type BusinessPeopleList = {
  people: BusinessPerson[];
  membersWithoutProfile: MemberWithoutProfile[];
  /** `null` when the payroll module is off: no salary to pick. */
  salaryTypes: SalaryTypeOption[] | null;
};
