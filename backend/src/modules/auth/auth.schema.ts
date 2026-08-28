import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
