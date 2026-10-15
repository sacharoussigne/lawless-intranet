export const waitlistKeys = {
  all: (shelterSlug: string) => ['waitlist', shelterSlug] as const,
  requests: (shelterSlug: string) => ['waitlist', shelterSlug, 'requests'] as const,
  preview: (shelterSlug: string) => ['waitlist', shelterSlug, 'preview'] as const,
};
