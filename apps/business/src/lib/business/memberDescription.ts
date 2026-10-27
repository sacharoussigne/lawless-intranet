import prisma from '@/lib/prisma';
import { employmentOfAccounts } from '@/lib/staff/access';

/** Title of a member in the letters: set by hand, otherwise the RP grade while employed. */
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
  if (member?.description) return member.description;

  const employment = (await employmentOfAccounts(businessId, [userId])).get(userId);
  return employment?.employed ? (employment.grade ?? null) : null;
}
