export type WeeklyActivityRealtimeEvent = {
  type: 'weeklyActivity';
  activityId: string;
  ownerUserId: string | null;
  ownerDiscordUserId: string;
  periodStart: string;
  periodEnd: string;
  originClientId?: string;
};

export type WeeklyActivityMutationMeta = {
  originClientId?: string;
};
