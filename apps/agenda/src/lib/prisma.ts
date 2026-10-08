import { createPrismaClient } from '@lawless-intranet/service-kit/prisma';
import { PrismaClient } from '@/generated/prisma/client';

const prisma = createPrismaClient((adapter) => new PrismaClient({ adapter }));

export default prisma;
