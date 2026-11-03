import type { PrismaClient } from "@prisma/client";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;

export function createUserRepository(prisma: PrismaClient) {
  return {
    findByEmail(email: string) {
      return prisma.user.findUnique({ where: { email } });
    },
    findPublicById(id: string) {
      return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    },
    create(data: { email: string; passwordHash: string; name: string }) {
      return prisma.user.create({ data, select: publicUserSelect });
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
