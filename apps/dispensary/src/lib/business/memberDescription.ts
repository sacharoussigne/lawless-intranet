import prisma from '@/lib/prisma';

export async function getMemberDescription(
  businessId: string,
  userId: string,
): Promise<string | null> {
  const member = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId,
      },
    },
    select: { description: true },
  });

  return member?.description ?? null;
}
