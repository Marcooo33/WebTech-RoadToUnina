import { prisma } from "../../lib/prisma.js";
import type { User } from "../../generated/prisma/client.js";
import { normalizeEmail } from "./auth.validation.js";

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

export function createUser(input: CreateUserInput): Promise<User> {
  return prisma.user.create({ data: input });
}

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function findActiveUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({ where: { id, deletedAt: null } });
}

export function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserByIdentifier(identifier: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ username: identifier }, { email: normalizeEmail(identifier) }],
    },
  });
}

export async function updateUserProfile(
  id: string,
  data: { username?: string; email?: string },
): Promise<User | null> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id, deletedAt: null },
      data,
    });
    if (result.count === 0) return null;
    return tx.user.findUnique({ where: { id } });
  });
}

export async function updateUserPassword(
  id: string,
  passwordHash: string,
): Promise<boolean> {
  const result = await prisma.user.updateMany({
    where: { id, deletedAt: null },
    data: { passwordHash },
  });
  return result.count === 1;
}

export interface SoftDeleteUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

export function softDeleteUser(
  id: string,
  input: SoftDeleteUserInput,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id, deletedAt: null },
      data: {
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        deletedAt: new Date(),
      },
    });
    if (result.count === 0) return false;

    await tx.game.deleteMany({ where: { userId: id, status: "IN_PROGRESS" } });
    return true;
  });
}
