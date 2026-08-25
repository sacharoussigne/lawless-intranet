export type WaitlistRealtimeEvent = {
  type: 'waitlist';
  shelterId: string;
  originClientId?: string;
};

export type WaitlistMutationMeta = {
  originClientId?: string;
};
