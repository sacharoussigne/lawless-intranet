import { realtimeMutationMeta } from '@lawless-intranet/realtime';

export type AgendaMutationMeta = {
  originClientId?: string;
};

export function agendaMutationMeta(
  clientId: string | null | undefined,
): AgendaMutationMeta | undefined {
  return realtimeMutationMeta(clientId);
}
