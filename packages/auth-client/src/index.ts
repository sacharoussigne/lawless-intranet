import type { Session } from "@lawless-intranet/types";

export async function getSession(): Promise<Session | null> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_AUTH_URL}/api/session`,
    {
      credentials: "include"
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}