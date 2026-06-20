import prisma from '@/lib/prisma';

export async function getMemberDescription(
  dispensaryId: string,
  userId: string,
): Promise<string | null> {
  const member = await prisma.dispensaryMember.findUnique({
    where: {
      dispensaryId_userId: {
        dispensaryId,
        userId,
      },
    },
    select: { description: true },
  });

  return member?.description ?? null;
}
