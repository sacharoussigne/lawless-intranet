export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  discordId: string | null;
  hasCredentialPassword?: boolean;
};

export type AuthSession = {
  session: {
    id: string;
    expiresAt: string;
    impersonatedBy?: string | null;
  };
  user: AuthUser;
};

export type AuthUserPublic = Pick<
  AuthUser,
  "id" | "name" | "image" | "discordId" | "email" | "role"
>;
