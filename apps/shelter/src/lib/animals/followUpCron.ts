import prisma from '@/lib/prisma';

/** Marks stale awaiting_recipient follow-ups as no_reply (for N8N cron). */
export async function markStaleFollowUpsNoReply(olderThanDays = 3) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const candidates = await prisma.animalFollowUp.findMany({
    where: { status: 'awaiting_recipient' },
    select: {
      id: true,
      date: true,
      messages: {
        orderBy: [{ letterDate: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: { letterDate: true },
      },
    },
  });

  const ids = candidates
    .filter((row) => {
      const last = row.messages[0]?.letterDate ?? row.date;
      return last.getTime() <= cutoff.getTime();
    })
    .map((row) => row.id);

  if (ids.length === 0) {
    return { updated: 0 };
  }

  const result = await prisma.animalFollowUp.updateMany({
    where: { id: { in: ids }, status: 'awaiting_recipient' },
    data: { status: 'no_reply' },
  });

  return { updated: result.count };
}
