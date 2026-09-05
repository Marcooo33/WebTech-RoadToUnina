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

export function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserByIdentifier(identifier: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: normalizeEmail(identifier) }],
    },
  });
}
